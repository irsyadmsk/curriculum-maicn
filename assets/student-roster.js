/* One local roster for directory, attendance and assessment forms. No remote writes. */
(() => {
  'use strict';
  const source = window.MAICN_STUDENT_ROSTER;
  const classrooms = ['X-1','X-2','X-3'];
  const fields = ['f1','f2','f3','f4','asts','asas'];
  const forClass = classroom => [...(source?.classes?.[classroom] || [])];
  const assigned = () => classrooms.flatMap(forClass);
  const unassigned = () => [...(source?.unassigned || [])];
  const all = () => [...assigned(),...unassigned()];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function parseScore(value) {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
    if (!['number','string'].includes(typeof value)) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
  }
  function calculateScores(scores = {}) {
    const values = fields.map(field => parseScore(scores[field]));
    const formatif = values.slice(0,4);
    const avgF = formatif.every(value => value !== null) ? formatif.reduce((sum,value)=>sum+value,0)/4 : null;
    const complete = values.every(value => value !== null);
    const na = complete ? .4*avgF + .3*values[4] + .3*values[5] : null;
    return {avgF:avgF===null?null:Math.round(avgF*10)/10,na:na===null?null:Math.round(na*10)/10,complete};
  }
  function scoreStorageKey(classroom,mapel,semester='ganjil') {
    if(!classrooms.includes(classroom)||typeof mapel!=='string'||!mapel.trim()||!['ganjil','genap'].includes(semester))throw new Error('Kelas, semester, dan mata pelajaran wajib dipilih.');
    const actor=window.CurriculumAccess?.has('teacher')?window.CurriculumAccess.context.user_id:null;
    return actor?`maicn_rapor_roster_v2_${encodeURIComponent(actor)}_2026-2027_${semester}_${classroom}_${encodeURIComponent(mapel)}`:`maicn_rapor_roster_v1_2026-2027_${semester}_${classroom}_${encodeURIComponent(mapel)}`;
  }
  window.StudentRoster = Object.freeze({forClass,assigned,unassigned,all,escapeHTML,parseScore,calculateScores,scoreStorageKey,
    emptyScores:()=>Object.fromEntries(fields.map(field=>[field,null])),
    formatScore:value=>parseScore(value)===null?'—':Number(value).toFixed(1),
    source:source?.source, tahunPelajaran:source?.tahunPelajaran});

  function bindStudentSelect(nameId,classId) {
    const names=document.getElementById(nameId),classes=document.getElementById(classId);
    if(!names||!classes)return;
    const render=()=>{
      const previous=names.value;
      names.replaceChildren(new Option('Pilih murid…',''));
      for(const student of forClass(classes.value))names.append(new Option(student.nama,student.nama));
      names.value=forClass(classes.value).some(student=>student.nama===previous)?previous:'';
    };
    classes.addEventListener('change',render);
    names.form?.addEventListener('reset',()=>queueMicrotask(render));render();
  }

  function initializeDirectory() {
    const list=document.getElementById('student-directory-list');
    if(!list)return;
    const search=document.getElementById('student-directory-search');
    const filter=document.getElementById('student-directory-class');
    const current=new URLSearchParams(location.search).get('kelas');
    if([...classrooms,'pending'].includes(current))filter.value=current;
    document.getElementById('student-total').textContent=all().length;
    document.getElementById('student-assigned').textContent=assigned().length;
    document.getElementById('student-unassigned').textContent=unassigned().length;
    for(const classroom of classrooms)document.querySelector(`[data-class-count="${classroom}"]`).textContent=forClass(classroom).length;
    document.getElementById('student-source-file').textContent=source?.source.file||'Sumber belum tersedia';
    const render=()=>{
      const query=search.value.trim().toLocaleLowerCase('id');
      const matches=all().filter(student=>(filter.value==='all'||(filter.value==='pending'?!student.kelas:student.kelas===filter.value))&&student.nama.toLocaleLowerCase('id').includes(query));
      document.getElementById('student-directory-count').textContent=`${matches.length} dari ${all().length} murid`;
      document.getElementById('student-directory-empty').hidden=matches.length>0;
      list.replaceChildren();
      for(const student of matches){
        const card=document.createElement('article');card.className='ui-student-card';
        card.innerHTML=`<div class="ui-student-avatar" aria-hidden="true">${escapeHTML(student.nama.split(/\s+/).slice(0,2).map(word=>word[0]).join(''))}</div><div class="ui-student-info"><h3>${escapeHTML(student.nama)}</h3><p>${student.kelas?`Nomor urut ${student.nomor} pada lembar ${escapeHTML(student.kelas)}`:'Menunggu penetapan kelas'}</p></div><span class="ui-chip ${student.kelas?'ui-chip-green':''}">${escapeHTML(student.kelas||'Belum ada kelas')}</span>`;
        list.append(card);
      }
    };
    search.addEventListener('input',render);filter.addEventListener('change',()=>{
      const url=new URL(location.href);if(filter.value==='all')url.searchParams.delete('kelas');else url.searchParams.set('kelas',filter.value);history.replaceState(null,'',url);render();
    });render();
  }

  const initialize=()=>{bindStudentSelect('obs-nama','obs-kelas');bindStudentSelect('mut-nama','mut-kelas');initializeDirectory();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
