import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {accountTarget,ssoLink,connectSession} from '../assets/account-sso.mjs';
test('SSO returns to a local page without allowing redirect injection or loops',()=>{
 for(const bad of ['https://evil.test/','//evil.test','/akun.html','/index.html?redirect=evil','/murid.html%0a'])assert.equal(accountTarget(bad),'/index.html');
 const login=new URL(ssoLink('https://curriculum.irsyads.com','/murid.html'));
 assert.equal(login.origin,'https://id.irsyads.com');const callback=new URL(login.searchParams.get('redirect'));
 assert.equal(callback.origin,'https://curriculum.irsyads.com');assert.equal(callback.pathname,'/akun.html');assert.equal(callback.searchParams.get('next'),'/murid.html');assert.equal(callback.searchParams.get('sso'),'return');
});
test('SSO bridge requires server verification and never invents privileges',async()=>{
 let calls=0;assert.equal(await connectSession({getSession:async()=>null},()=>{calls++}),false);assert.equal(calls,0);
 const db={getSession:async()=>({access_token:'fixture-token',user:{role:'admin'}})};
 await assert.rejects(connectSession(db,async()=>({ok:false})));
 assert.equal(await connectSession(db,async(url,options)=>{assert.equal(url,'/api/session');assert.equal(options.credentials,'same-origin');assert.deepEqual(JSON.parse(options.body),{token:'fixture-token'});return{ok:true}}),true);
});
test('shared SSO adapter reads split parent cookies and excludes origin-local login on production',async()=>{
 const source=await fs.readFile('assets/irsyads-session.js','utf8');
 const context=vm.createContext({document:{cookie:'session.0='+encodeURIComponent('{"a":')+'; session.1='+encodeURIComponent('1}')},location:{hostname:'curriculum.irsyads.com',protocol:'https:'},localStorage:{getItem(){throw Error('must not read local storage')}},atob});vm.runInContext(source,context);
 assert.equal(context.IrsyadsCurriculumSession.penyimpananSesi.getItem('session'),'{"a":1}');
 context.document.cookie='session.1=invalid';assert.equal(context.IrsyadsCurriculumSession.penyimpananSesi.getItem('session'),null);
});
test('site headers use Curriculum branding; school identity is confined to calendar presentation',async()=>{
 for(const file of (await fs.readdir('.')).filter(n=>n.endsWith('.html'))){const html=await fs.readFile(file,'utf8');assert.doesNotMatch(html,/MA\s+Insan\s+Cendekia\s+Nusantara/i,file);if(file!=='kalender.html')assert.doesNotMatch(html,/\bMA ICN\b/,file);assert.doesNotMatch(html,/src="assets\/iconmaicn.png"/,file);}
 const html=await fs.readFile('akun.html','utf8');assert.doesNotMatch(html,/id="account-(email|password)"/);assert.match(html,/Masuk dengan Irsyads ID/);
 const data=await fs.readFile('assets/curriculum-data.js','utf8');assert.match(data,/storage: sessionRuntime.penyimpananSesi/);assert.match(data,/INITIAL_SESSION/);
});
