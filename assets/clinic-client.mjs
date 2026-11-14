import {CLINIC_REMOTE_ENABLED,INSTITUTION,YEAR,parseRows,inSchoolYear,isDate,BLOCK_CHOICES} from './clinic-core.mjs';
export function parseBlockSnapshot(data,year=YEAR,institution=INSTITUTION) {
 if(!data||data.version!==1||data.institution!==institution||data.year!==year||typeof data.can_review!=='boolean'||!Array.isArray(data.rows)||data.rows.length>1000||data.count!==data.rows.length||!Number.isFinite(Date.parse(data.read_at)))throw Error('Agenda blok belum dibaca lengkap.');
 const dates=new Set();
 for(const r of data.rows){if(!r||!isDate(r.date)||new Date(r.date).getUTCDay()!==1||!inSchoolYear(r.date,year)||r.institution!==institution||r.year!==year||dates.has(r.date)||!BLOCK_CHOICES.includes(r.activity)||typeof r.note!=='string'||r.note.length>2000||!Number.isSafeInteger(r.revision)||r.revision<1||!Number.isFinite(Date.parse(r.updated_at)))throw Error('Agenda blok tidak valid.');dates.add(r.date)}
 return data;
}
export function parseSnapshot(data, mode, year = YEAR, institution = INSTITUTION) {
  if (!data || data.version !== 1 || data.institution !== institution || data.year !== year || typeof data.can_review !== 'boolean' || !Number.isInteger(data.count) || !Array.isArray(data.rows) || data.count !== data.rows.length || !Array.isArray(data.teachers) || !Number.isFinite(Date.parse(data.read_at))) throw Error('Data klinik belum berhasil dibaca lengkap.');
  const rows = parseRows(data.rows, mode === 'public');
  if(rows.some(r => !inSchoolYear(r.date,year) || mode !== 'public' && (r.year !== year || r.institution !== institution)))throw Error('Konteks klinik berubah. Muat ulang sebelum melanjutkan.');
  const codes = new Set();
  const teachers = data.teachers.map(t => { if (!t || !/^[A-Z]{2,4}$/.test(t.kode) || codes.has(t.kode) || typeof t.nama !== 'string' || !t.nama.trim() || t.nama.length > 200) throw Error('Daftar pengampu belum valid.'); codes.add(t.kode); return {kode:t.kode,nama:t.nama,mapel:typeof t.mapel === 'string'? t.mapel:''}; });
  return {...data, rows, teachers};
}
export function clinicClient(client, enabled = CLINIC_REMOTE_ENABLED) {
  const available = () => { if (!enabled || !client) throw Error('Pengiriman dan konfirmasi Curriculum belum diaktifkan. Draf tetap tersimpan pada perangkat ini.'); };
  async function account(owner) {
    const {data,error} = await client.auth.getSession();
    if (error || !owner || data.session?.user.id !== owner) throw Error('Akun berubah atau sesi berakhir. Muat ulang sebelum melanjutkan.');
  }
  async function rpc(name, args, owner, signal) {
    available(); if (owner) await account(owner);
    const controller = new AbortController(), abort = () => controller.abort();
    signal?.addEventListener('abort', abort, {once:true});
    const timer = setTimeout(abort, /write|allocate|retarget/.test(name)?45000:20000);
    try {
      if (signal?.aborted) throw Error('Pembacaan dibatalkan.');
      const {data,error} = await client.rpc(name,args).abortSignal(controller.signal);
      if (error) {
        const m = String(error.message || '');
        if(m.includes('clinic_location_conflict'))throw Error('Lokasi sudah dipakai klinik lain pada jam yang sama. Pilih lokasi berbeda.');
        if(m.includes('invalid_location'))throw Error('Pilih lokasi yang terdaftar. Admin dapat menambahkan lokasi baru.');
        if (m.includes('invalid_transition')) throw Error('Status ajuan sudah berubah. Muat ulang sebelum memutuskan atau memindahkan peserta.');
        if (m.includes('decision_note_required')) throw Error('Isi alasan keputusan atau pemindahan terlebih dahulu.');
        if (m.includes('identity_or_location_required')) throw Error('Periksa identitas pengaju dan tetapkan lokasi pada tab Identitas & lokasi sebelum menerima.');
        if (m.includes('stale_revision')) throw Error('Usulan sudah diubah di tempat lain. Muat ulang dan tinjau kembali.');
        if (m.includes('clinic_participant_conflict')) throw Error('Peserta sudah diterima di klinik pada waktu yang bertabrakan. Muat ulang daftar ajuan.');
        if (m.includes('clinic_conflict')) throw Error('Bentrok: kelas atau guru sudah terjadwal pada waktu yang sama.');
        if (m.includes('enrichment_finalized')) throw Error('Pembagian pengayaan sudah ditetapkan. Buka seleksi kembali sebelum mengubah klinik.');
        if (m.includes('invalid_participants')) throw Error('Daftar peserta belum valid. Ajuan lama tanpa peserta perlu dibuat ulang dari daftar resmi.');
        if (m.includes('allocation_choice_required')) throw Error('Tentukan klinik tujuan untuk setiap murid yang bertabrakan.');
        if (m.includes('clinic_empty_selection')) throw Error('Setiap klinik yang diterima harus memiliki peserta. Tinjau pilihan penempatannya.');
        if (m.includes('clinic_allocation_locked')) throw Error('Klinik ini masih menjadi tujuan pengecualian klinik lain. Tinjau keputusan terkait sebelum mengubah jadwal atau membatalkan.');
        if (m.includes('forbidden')) throw Error('Akun ini tidak memiliki izin untuk tindakan tersebut.');
        if (m.includes('archived_schedule_locked')) throw Error('Sesi sudah masuk arsip. Gunakan catatan laporan untuk tindak lanjut.');
        throw Error('Server belum dapat memastikan tindakan ini. Muat ulang untuk memeriksa hasil sebelum mencoba kembali.');
      }
      if (controller.signal.aborted) throw Error('Waktu pemeriksaan habis. Muat ulang untuk memeriksa hasil.');
      if (owner) await account(owner);
      return data;
    } catch(error) {
      if(error instanceof TypeError||controller.signal.aborted){const failure=Error('Koneksi terputus atau terlalu lama. Status keputusan perlu diperiksa kembali.');failure.uncertain=true;throw failure}throw error;
    } finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
  }
  return {
    async blocks({owner,year=YEAR,institution=INSTITUTION,signal}={}) {return parseBlockSnapshot(await rpc('curriculum_monday_read',{p_institution:institution,p_year:year},owner,signal),year,institution)},
    async saveBlock({owner,year=YEAR,institution=INSTITUTION,revision,data,token,signal}) {
      const result=await rpc('curriculum_monday_write',{p_institution:institution,p_year:year,p_expected:revision,p_data:data,p_token:token},owner,signal);
      if(!result||result.date!==data.date||result.revision!==revision+1||result.token!==token)throw Error('Penetapan blok belum dapat dipastikan. Muat ulang sebelum mencoba kembali.');
      return result;
    },
    async read({mode='public',owner,year=YEAR,institution=INSTITUTION,signal}={}) {
      if (mode !== 'public' && !owner) throw Error('Masuk melalui akun Irsyads terlebih dahulu.');
      return parseSnapshot(await rpc(mode==='review'?'curriculum_clinic_review_v2':'curriculum_clinic_read',{p_institution:institution,p_year:year,p_mode:mode},mode==='public'?null:owner,signal),mode,year,institution);
    },
    async write({owner,year=YEAR,institution=INSTITUTION,action,id,revision,data,token,signal}) {
      const name=action==='retarget'?'curriculum_clinic_retarget':action==='approve'&&data?.assignments?'curriculum_clinic_allocate':'curriculum_clinic_write',args={p_institution:institution,p_year:year,p_action:action,p_id:id,p_expected:revision,p_data:data,p_token:token};
      let result;
      try{result=await rpc(name,args,owner,signal)}catch(error){
        if(!error.uncertain||signal?.aborted)throw error;
        // Exact same intent/token: SQL returns the prior receipt if already committed.
        result=await rpc(name,args,owner,signal);
      }
      if (!result || result.id !== id || result.token !== token || result.revision !== revision + 1 || !['pending','approved','rejected','cancelled'].includes(result.status)) throw Error('Hasil simpan belum dapat dipastikan. Muat ulang sebelum mencoba lagi.');
      return result;
    },
    async enrichment({owner,year=YEAR,institution=INSTITUTION,id,revision,action,signal}) {
      const data=await rpc('curriculum_clinic_enrichment',{p_institution:institution,p_year:year,p_id:id,p_expected:revision,p_action:action},owner,signal);
      if(!data||data.id!==id||data.finalized!==(action==='finalize'))throw Error('Penetapan belum dapat dipastikan. Muat ulang untuk memeriksa hasil.');
      return data;
    },
    async history(id,owner,signal) {
      const rows=await rpc('curriculum_clinic_history',{p_id:id},owner,signal);
      if(!Array.isArray(rows)||rows.length>5000)throw Error('Riwayat belum dibaca lengkap.');
      return rows.map((r,index)=>{if(!r||r.request_id!==id||r.revision!==index+1||!['submit','edit','approve','reject','cancel','report','allocate'].includes(r.action)||!Number.isFinite(Date.parse(r.occurred_at)))throw Error('Riwayat revisi tidak lengkap.');const snapshot=parseRows([r.snapshot])[0];if(snapshot.id!==id||snapshot.revision!==r.revision)throw Error('Riwayat tidak cocok.');return {revision:r.revision,action:r.action,occurred_at:r.occurred_at,snapshot}});
    }
  };
}
