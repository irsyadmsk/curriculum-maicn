import test from 'node:test';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import fs from 'node:fs/promises';import vm from 'node:vm';import assert from 'node:assert/strict';
const require=createRequire(new URL('../../irsyads/package.json',import.meta.url)),{JSDOM}=require('jsdom'),{build}=require('esbuild'),base=fileURLToPath(new URL('../',import.meta.url)).replace(/[\\/]$/,'');
test("guest Clinic: visible validation and submission without Web Locks",async()=>{
const catalog={version:2,year:'2026/2027',students:[{id:'a',nama:'Murid A',kelas:'X-1'},{id:'b',nama:'Murid B',kelas:'X-2'}],teachers:[{kode:'AA',nama:'Guru A',mapel:'Fisika'}],lessons:[],projects:[]};
const guest={role:'guest',user_id:null,capabilities:{}};
const dom=new JSDOM(await fs.readFile(base+'/klinik.html','utf8'),{url:'https://curriculum.test/klinik.html',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,errors=[];w.addEventListener('error',e=>errors.push(e.message));
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
const sent=[];w.turnstile={render(s,options){options.callback('synthetic-challenge');return 1},reset(){}};
w.fetch=async(url,options)=>({ok:true,json:async()=>{if(String(url).includes('catalog'))return catalog;if(String(url).endsWith('/request')){const p=JSON.parse(options.body);sent.push(p);return {id:p.id,token:p.token,status:'pending',revision:1}}if(String(url).endsWith('/receipt'))return {found:false};return {clinic_v2_enabled:true,turnstile_site_key:'synthetic-fixture'}}});
w.CurriculumClinicProxy={rpc(){return{abortSignal:async()=>({data:{version:1,institution:'MA Insan Cendekia Nusantara',year:'2026/2027',can_review:false,count:0,rows:[],teachers:catalog.teachers,read_at:new Date().toISOString()}})}}};
w.setInterval=()=>0;
const result=await build({entryPoints:[base+'/assets/clinic-page.mjs'],bundle:true,write:false,format:'esm',plugins:[{name:'access-fixture',setup(b){b.onResolve({filter:/curriculum-access\.mjs$/},()=>({path:'access',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const accessReady=Promise.resolve();export const access={context:${JSON.stringify(guest)},has:()=>false,subscribe:()=>{}};`}))}}]});
await new vm.Script('(async()=>{'+result.outputFiles[0].text+'})()').runInContext(dom.getInternalVMContext());
await new Promise(r=>setTimeout(r,30));
const $=s=>w.document.querySelector(s);await $('#clinic-new').onclick();assert.equal($('#clinic-dialog').open,true);assert.deepEqual(errors,[]);
const form=$('#clinic-form'),submit=()=>form.onsubmit({preventDefault(){},submitter:$('#clinic-send'),currentTarget:form});
await submit();assert.match($('#clinic-form-error').textContent,/Lengkapi Kelas pengaju/);assert.equal(sent.length,0);
$('#clinic-kind').value='teacher';$('#clinic-kind').dispatchEvent(new w.Event('change'));$('#clinic-teacher').value='AA';$('#clinic-teacher').dispatchEvent(new w.Event('change'));$('#clinic-date').value='2026-12-07';$('#clinic-date').onchange({target:$('#clinic-date')});$('#clinic-target').value='class';$('#clinic-target').onchange();$('#clinic-email').value='teacher@example.test';$('#clinic-evidence').value='https://drive.google.com/file/d/abcdefghijklmno/view';
await submit();assert.equal(sent.length,1,$('#clinic-form-error').textContent);assert.equal(sent[0].data.requester_id,'AA');assert.equal($('#clinic-dialog').open,false);assert.equal(JSON.stringify(Object.values(w.localStorage)).includes('identity_photo'),false);

dom.window.close();

});
test("custom cocurricular project and empty collaboration catalog",async()=>{
const catalog={students:[{id:'a',nama:'Murid A',kelas:'X-1'}],teachers:[{kode:'AA',nama:'Guru A',mapel:'Fisika'}],lessons:[],projects:[]},ctx={role:'guest',user_id:null};
const dom=new JSDOM(await fs.readFile(base+'/layanan.html','utf8'),{url:'https://curriculum.test/layanan.html?kind=collaboration',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,sent=[];
w.turnstile={render(s,o){o.callback('synthetic-challenge');return 1},remove(){},reset(){}};
w.fetch=async(url,o)=>({ok:true,json:async()=>{if(String(url).includes('catalog'))return catalog;if(String(url).endsWith('/request')){const p=JSON.parse(o.body);sent.push(p);return{id:p.id,token:p.token,status:'pending',revision:1}}if(String(url).endsWith('/receipt'))return{found:true,status:'pending',revision:1};return{school_enabled:true,turnstile_site_key:'synthetic-fixture'}}});
const compiled=await build({entryPoints:[base+'/assets/school-services.mjs'],bundle:true,write:false,format:'esm',plugins:[{name:'access-fixture',setup(b){b.onResolve({filter:/curriculum-access\.mjs$/},()=>({path:'access',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const accessReady=Promise.resolve();export const access={context:${JSON.stringify(ctx)},has:()=>false,subscribe:()=>{}};`}))}}]});
await new vm.Script('(async()=>{'+compiled.outputFiles[0].text+'})()').runInContext(dom.getInternalVMContext());const $=s=>w.document.querySelector(s);await new Promise(r=>setTimeout(r,10));
assert.match($('#school-project-label').textContent,/Belum ada pilihan kolaborasi/);$('#school-title').value='Gagasan sendiri';$('#school-create-project').click();assert.equal($('#school-kind').value,'project');assert.equal($('#school-title').value,'Gagasan sendiri');assert.equal($('#school-send').disabled,false);
const form=$('#school-form'),submit=()=>form.onsubmit({preventDefault(){}});await submit();assert.match($('#school-error').textContent,/Lengkapi/);assert.equal(sent.length,0);
$('[data-identity-name]').value='AA';$('[data-identity-name]').onchange();$('#school-date').value='2026-12-08';$('#school-date').onchange();$('#school-end-date').value='2026-12-09';$('#school-tp').value='Menerapkan konsep pada kegiatan';$('#school-reason').value='Murid berlatih bersama';$('#school-email').value='teacher@example.test';$('#school-evidence').value='https://drive.google.com/file/d/abcdefghijklmno/view';
await submit();assert.equal(sent.length,1,$('#school-error').textContent);assert.equal(sent[0].kind,'project');assert.equal(sent[0].data.title,'Gagasan sendiri');assert.equal(sent[0].data.requester_id,'AA');assert.equal(sent[0].data.teacher_code,'AA');assert.match($('#school-notice').textContent,/menunggu/i);dom.window.close();

});
