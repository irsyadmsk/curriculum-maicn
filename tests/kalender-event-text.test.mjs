import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';
const require=createRequire(new URL('../../irsyads/package.json',import.meta.url)),{JSDOM}=require('jsdom');
test('calendar event titles from the database render as text, never as markup',async()=>{
 const source=await readFile(new URL('../kalender.html',import.meta.url),'utf8'),block=source.match(/evts\.forEach\(e=>\{[\s\S]*?\r?\n\s*\}\);/)?.[0];
 assert.ok(block,'event pill block');
 const dom=new JSDOM('<div id="ep"></div>',{runScripts:'outside-only'}),title='<img src=x onerror="window.__ran=1">';
 dom.window.evts=[{label:title,color:'rgb(26, 107, 60)'}];
 dom.window.eval(`const ep=document.getElementById('ep');${block}`);
 const doc=dom.window.document;
 assert.equal(doc.querySelector('img'),null);
 assert.equal(doc.querySelector('.event-pill .event-txt').textContent,title);
 assert.equal(doc.querySelector('.event-pill .event-dot').style.background,'rgb(26, 107, 60)');
 dom.window.close();
});
