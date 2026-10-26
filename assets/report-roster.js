// Local grade editor using the shared pupil roster. Missing scores remain missing.

  // ══════════════════════════════════════════════════
  // E-RAPOR & LEGER ENGINE (RUJUKAN KURIKULUM MADRASAH)
  // ══════════════════════════════════════════════════

  const KKTP_THRESHOLD = 75.0;

  // Shared names/classes imported from the owner-provided workbook.
  const ROSTER_DATA = Object.fromEntries(['X-1','X-2','X-3'].map(kelas => [kelas, window.StudentRoster.forClass(kelas)]));
  const rosterEscape = window.StudentRoster.escapeHTML;
  const scoreText = window.StudentRoster.formatScore;

  function selectedSemester() {
    return document.getElementById('select-semester')?.value === 'Genap' ? 'genap' : 'ganjil';
  }

  // Missing scores stay blank; legacy demo keys are never adopted.
  function getScores(rombel, mapel) {
    const key = window.StudentRoster.scoreStorageKey(rombel,mapel,selectedSemester());
    const raw = localStorage.getItem(key);
    if (raw === null) return {};
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Simpanan nilai tidak dapat dibaca. Data lama tetap dipertahankan.');
    return value;
  }

  function saveScores(rombel, mapel, scores) {
    localStorage.setItem(window.StudentRoster.scoreStorageKey(rombel,mapel,selectedSemester()),JSON.stringify(scores));
  }

  // 40% Formatif + 30% ASTS + 30% ASAS
  function calculateNA(f1,f2,f3,f4,asts,asas) {
    return window.StudentRoster.calculateScores({f1,f2,f3,f4,asts,asas});
  }

  function getPredikat(na) {
    if (na === null) return {code:'—',label:'Belum lengkap'};
    if (na >= 93) return { code: 'A', label: 'Istimewa' };
    if (na >= 85) return { code: 'B', label: 'Sangat Baik' };
    if (na >= 75) return { code: 'C', label: 'Baik (Tuntas)' };
    return { code: 'D', label: 'Perlu Remedial' };
  }

  function generateNarasi(nama, mapel, na) {
    if (na === null) return 'Nilai mata pelajaran belum lengkap.';
    if (na >= 90) {
      return `Menunjukkan penguasaan sangat istimewa dalam menguasai konsep dan aplikasi materi ${mapel}, serta memiliki ketuntasan belajar yang optimal.`;
    } else if (na >= 80) {
      return `Menunjukkan pemahaman yang sangat baik dalam materi ${mapel}, terampil dalam tugas praktik dan diskusi kelas.`;
    } else if (na >= 75) {
      return `Mencapai kriteria ketuntasan minimal pada materi ${mapel}, disarankan untuk terus memperbanyak latihan mandiri.`;
    } else {
      return `Perlu pendampingan dan bimbingan lebih lanjut dalam memahami materi pokok ${mapel} melalui program Klinik Pembelajaran.`;
    }
  }

  // Current State
  let currentRombel = 'X-1';
  let currentMapel = 'Sosiologi';
  let currentScores = {};

  function populateMapelDropdown() {
    const select = document.getElementById('select-mapel');
    if (!select) return;
    select.innerHTML = '';

    const mapels = (window.MASTER_DATA && window.MASTER_DATA.distribusi_jp)
      ? window.MASTER_DATA.distribusi_jp
      : [
        { mapel: "Al-Qur'an Hadis" }, { mapel: "Akidah Akhlak" }, { mapel: "Fikih" },
        { mapel: "Sejarah Kebudayaan Islam" }, { mapel: "Bahasa Arab" }, { mapel: "Sosiologi" },
        { mapel: "Biologi" }, { mapel: "Fisika" }, { mapel: "Kimia" }, { mapel: "Matematika" }
      ];

    mapels.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.mapel;
      opt.textContent = m.mapel;
      if (m.mapel === 'Sosiologi') opt.selected = true;
      select.appendChild(opt);
    });
    currentMapel = select.value || 'Sosiologi';
  }

  function onFilterChange() {
    currentRombel = document.getElementById('select-rombel').value;
    currentMapel = document.getElementById('select-mapel').value;
    currentScores = getScores(currentRombel, currentMapel);
    renderTable();
    renderLegerTable();
    populateStudentPreviewDropdown();
  }

  function renderTable() {
    const tbody=document.getElementById('rapor-tbody');if(!tbody)return;
    const students=ROSTER_DATA[currentRombel]||[];
    let totalNA=0,tuntasCount=0,completeCount=0;
    tbody.innerHTML=students.map((s,index)=>{
      const sc=currentScores[s.id]||window.StudentRoster.emptyScores();
      const calc=window.StudentRoster.calculateScores(sc);
      const tuntas=calc.complete&&calc.na>=KKTP_THRESHOLD;
      if(calc.complete){totalNA+=calc.na;completeCount++;if(tuntas)tuntasCount++;}
      const input=field=>`<td style="padding:6px;text-align:center"><input type="number" class="rapor-input-num" min="0" max="100" step="any" value="${window.StudentRoster.parseScore(sc[field])??''}" onchange="updateScore('${s.id}','${field}',this.value)" aria-label="${field.toUpperCase()} ${rosterEscape(s.nama)}"></td>`;
      const status=calc.complete?(tuntas?'<span class="badge-tuntas">TUNTAS</span>':'<span class="badge-remedial">REMEDIAL</span>'):'<span class="ui-chip">BELUM LENGKAP</span>';
      const action=calc.complete&&!tuntas?`<button type="button" class="btn-clay-pill primary" data-refer-student="${s.id}">Rujuk klinik</button>`:`<button type="button" class="btn-clay-pill white" onclick="viewStudentLHB(${index})">Lihat draf</button>`;
      return `<tr data-student-id="${s.id}"><td>${index+1}</td><td>${rosterEscape(s.nisn||'—')}</td><td style="font-weight:700">${rosterEscape(s.nama)}</td>${['f1','f2','f3','f4'].map(input).join('')}<td>${scoreText(calc.avgF)}</td>${['asts','asas'].map(input).join('')}<td>${scoreText(calc.na)}</td><td>${status}</td><td>${action}</td></tr>`;
    }).join('');
    document.getElementById('stat-mean-val').textContent=completeCount?(totalNA/completeCount).toFixed(1):'—';
    document.getElementById('stat-tuntas-pct').textContent=completeCount?((tuntasCount/completeCount)*100).toFixed(1)+'%':'—';
    document.getElementById('stat-tuntas-sub').textContent=`${tuntasCount} tuntas · ${completeCount} dari ${students.length} nilai lengkap`;
    document.getElementById('stat-rombel-label').textContent=currentRombel;
  }

  function updateScore(studentId,field,value) {
    if(!(ROSTER_DATA[currentRombel]||[]).some(student=>student.id===studentId))return;
    if(!['f1','f2','f3','f4','asts','asas'].includes(field))return;
    if(!currentScores[studentId])currentScores[studentId]=window.StudentRoster.emptyScores();
    currentScores[studentId][field]=window.StudentRoster.parseScore(value);
    saveScores(currentRombel,currentMapel,currentScores);
    renderTable();renderLegerTable();
  }

  function saveScoresToStorage() {
    saveScores(currentRombel, currentMapel, currentScores);
    alert('Nilai murid berhasil disimpan ke memori browser!');
  }

  function resetDefaultScores() {
    if(!confirm('Kosongkan nilai untuk kelas dan mata pelajaran ini?'))return;
    localStorage.removeItem(window.StudentRoster.scoreStorageKey(currentRombel,currentMapel,selectedSemester()));
    currentScores={};renderTable();renderLegerTable();
  }

  // ═════════ LEGER TABLE ═════════
  function renderLegerTable() {
    const tbody=document.getElementById('leger-tbody');if(!tbody)return;
    const students=ROSTER_DATA[currentRombel]||[];
    const list=students.map(student=>{
      const scores=currentScores[student.id]||window.StudentRoster.emptyScores();
      return {...student,...scores,...window.StudentRoster.calculateScores(scores)};
    }).sort((a,b)=>Number(b.complete)-Number(a.complete)||(a.complete?b.na-a.na:0));
    const completed=list.filter(item=>item.complete);
    let rank=0;
    tbody.innerHTML=list.map(item=>{
      const predikat=getPredikat(item.na);const tuntas=item.complete&&item.na>=KKTP_THRESHOLD;
      return `<tr><td>${item.complete?++rank:'—'}</td><td>${rosterEscape(item.nisn||'—')}</td><td>${rosterEscape(item.nama)}</td><td>${scoreText(item.avgF)}</td><td>${scoreText(item.asts)}</td><td>${scoreText(item.asas)}</td><td>${scoreText(item.na)}</td><td>${predikat.code}</td><td>${item.complete?(tuntas?'TUNTAS':'REMEDIAL'):'BELUM LENGKAP'}</td><td>${rosterEscape(generateNarasi(item.nama,currentMapel,item.na))}</td></tr>`;
    }).join('');
    document.getElementById('leger-title-text').textContent=`Rekapitulasi Leger Nilai Murid — ${currentRombel} (${currentMapel})`;
    const max=completed[0],min=completed[completed.length-1];
    document.getElementById('leger-max-val').textContent=scoreText(max?.na);
    document.getElementById('leger-max-student').textContent=max?.nama||'Belum ada nilai lengkap';
    document.getElementById('leger-min-val').textContent=scoreText(min?.na);
    document.getElementById('leger-min-student').textContent=min?.nama||'Belum ada nilai lengkap';
    document.getElementById('leger-tuntas-count').textContent=`${completed.filter(item=>item.na>=KKTP_THRESHOLD).length} / ${students.length}`;
    document.getElementById('leger-remed-count').textContent=`${completed.filter(item=>item.na<KKTP_THRESHOLD).length} murid · ${students.length-completed.length} belum lengkap`;
  }

  // ═════════ PRATINJAU RAPOR (LHB) ═════════
  function populateStudentPreviewDropdown() {
    const select = document.getElementById('select-preview-student');
    if (!select) return;
    select.innerHTML = '';
    const students = ROSTER_DATA[currentRombel] || [];
    students.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = s.nama;
      select.appendChild(opt);
    });
    renderLHBPreview(0);
  }

  function viewStudentLHB(studentIdx) {
    switchRaporTab('preview');
    const select = document.getElementById('select-preview-student');
    if (select) select.value = studentIdx;
    renderLHBPreview(studentIdx);
  }

  function renderLHBPreview(studentIdx) {
    const student=(ROSTER_DATA[currentRombel]||[])[studentIdx];if(!student)return;
    document.getElementById('lhb-nama').textContent=student.nama;
    document.getElementById('lhb-kelas').textContent=`Fase E / Kelas ${currentRombel}`;
    document.getElementById('lhb-nisn').textContent=`${student.nis||'Belum tersedia'} / ${student.nisn||'Belum tersedia'}`;
    document.getElementById('lhb-walikelas').textContent='Belum ditetapkan';
    document.getElementById('lhb-sign-walikelas').textContent='Belum ditetapkan';
    const mapels=[...new Set([...(window.MASTER_DATA?.distribusi_jp||[]).map(item=>item.mapel),currentMapel])].filter(Boolean);
    const tbody=document.getElementById('lhb-subjects-tbody');if(!tbody)return;
    tbody.innerHTML=mapels.map((mapel,index)=>{
      const scores=(mapel===currentMapel?currentScores:getScores(currentRombel,mapel))[student.id]||window.StudentRoster.emptyScores();
      const calc=window.StudentRoster.calculateScores(scores);const pred=getPredikat(calc.na);
      return `<tr><td>${index+1}</td><td>${rosterEscape(mapel)}</td><td>${scoreText(calc.na)}</td><td>${pred.code}</td><td>${rosterEscape(generateNarasi(student.nama,mapel,calc.na))}</td></tr>`;
    }).join('');
  }

  // ═════════ TAB SWITCHER ═════════
  function switchRaporTab(tabKey) {
    const tabs = ['input', 'leger', 'preview'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tabbtn-${t}`);
      const sec = document.getElementById(`rapor-tab-${t}`);
      if (btn) btn.classList.toggle('active', t === tabKey);
      if (sec) sec.style.display = t === tabKey ? 'block' : 'none';
    });
  }

  // ═════════ RUJUK KLINIK MODAL ═════════
  function openRujukModal(nama, na) {
    document.getElementById('rujuk-santri-nama').textContent = nama;
    document.getElementById('rujuk-santri-kelas').textContent = currentRombel;
    document.getElementById('rujuk-santri-mapel').textContent = currentMapel;
    document.getElementById('rujuk-santri-na').textContent = na;

    const modal = document.getElementById('modal-rujuk-klinik');
    if (modal) modal.classList.add('open');
  }

  function closeRujukModal() {
    const modal = document.getElementById('modal-rujuk-klinik');
    if (modal) modal.classList.remove('open');
  }

  // ═════════ EXPORT CSV ═════════
  function exportLegerCSV() {
    const list=(ROSTER_DATA[currentRombel]||[]).map(student=>{
      const scores=currentScores[student.id]||window.StudentRoster.emptyScores();
      return {...student,...scores,...window.StudentRoster.calculateScores(scores)};
    }).sort((a,b)=>Number(b.complete)-Number(a.complete)||(a.complete?b.na-a.na:0));
    const csvCell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
    const lines=[['Rank','NISN','Nama Murid','TP1','TP2','TP3','TP4','Rata_Formatif','ASTS','ASAS','Nilai_Akhir','Predikat','Status_KKTP']];
    let rank=0;
    for(const item of list)lines.push([item.complete?++rank:'',item.nisn,item.nama,item.f1,item.f2,item.f3,item.f4,item.avgF,item.asts,item.asas,item.na,getPredikat(item.na).code,item.complete?(item.na>=KKTP_THRESHOLD?'TUNTAS':'REMEDIAL'):'BELUM LENGKAP']);
    const blob=new Blob(['\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Leger_Nilai_${currentRombel}_${currentMapel}_2026.csv`;link.click();URL.revokeObjectURL(url);
  }

  // ═════════ INITIALIZATION ═════════
  function initializeGrades() {
    document.getElementById('rapor-tbody')?.addEventListener('click',event=>{const button=event.target.closest('[data-refer-student]');if(!button)return;const student=(ROSTER_DATA[currentRombel]||[]).find(item=>item.id===button.dataset.referStudent);if(!student)return;const calc=window.StudentRoster.calculateScores(currentScores[student.id]);if(calc.complete&&calc.na<KKTP_THRESHOLD)openRujukModal(student.nama,calc.na);});
    populateMapelDropdown();
    currentScores = getScores(currentRombel, currentMapel);
    renderTable();
    renderLegerTable();
    populateStudentPreviewDropdown();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeGrades, {once:true});
  else initializeGrades();
