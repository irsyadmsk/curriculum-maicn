/** Curated local asset build. Never upload the repository root. No remote operation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {PUBLIC_PAGES,TEACHER_PAGES,REVIEW_PAGES,routeAccess} from '../assets/access-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),target=path.join(root,'.site');
await fs.access(path.join(root,'assets/student-roster-data.js')).catch(()=>{throw Error('Private pupil roster is required. Import the owner workbook locally before building; never commit the generated roster to a public repository.');});
await fs.mkdir(target,{recursive:true});
const files=[...PUBLIC_PAGES,...TEACHER_PAGES,...REVIEW_PAGES,'p5-ppra.html','data.js','master-data.json','favicon.svg','favicon.ico','_headers'];
async function walk(dir){for(const item of await fs.readdir(path.join(root,dir),{withFileTypes:true})){if(item.isSymbolicLink())throw Error('Symlink is not a site asset');const name=dir+'/'+item.name;if(item.isDirectory())await walk(name);else if(/\.(?:css|js|mjs|json|svg|png|jpg|jpeg|webp|gif|woff2?|ttf|ico|docx|pdf)$/i.test(name))files.push(name)}}
await walk('assets');
const manifest=[];
const sandbox={window:{}};vm.runInNewContext(await fs.readFile(path.join(root,'data.js'),'utf8'),sandbox,{timeout:1000});
const original=sandbox.MASTER_DATA||sandbox.window.MASTER_DATA;
if(!original||!original.jadwal_kbm_v2)throw Error('Academic source unavailable');
const publicData=JSON.parse(JSON.stringify(original));
let legacy=publicData.klinik_pembelajaran?.jadwal_booking||[];
if(!legacy.length){try{legacy=JSON.parse(await fs.readFile(path.join(root,'private-inputs/clinic-legacy.json'),'utf8'));if(!Array.isArray(legacy))throw Error('Invalid private clinic input');}catch(error){if(error.code!=='ENOENT')throw error;}}
if(publicData.klinik_pembelajaran)delete publicData.klinik_pembelajaran.jadwal_booking;
for(const name of new Set(files)){
 const source=path.resolve(root,name),dest=path.resolve(target,name);if(!source.startsWith(root)||!dest.startsWith(target+path.sep))throw Error('Invalid build path');
 try{let bytes=await fs.readFile(source);if(name==='data.js')bytes=Buffer.from('window.MASTER_DATA = '+JSON.stringify(publicData)+';\n');if(name==='master-data.json')bytes=Buffer.from(JSON.stringify(publicData,null,2)+'\n');await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);manifest.push({path:name,access:routeAccess(name),bytes:bytes.length})}catch(e){if(e.code!=='ENOENT')throw e;else if(name.endsWith('.html'))throw Error('Required page missing: '+name)}
}
const legacyName='assets/clinic-legacy-data.js',legacyBytes=Buffer.from('window.MAICN_CLINIC_LEGACY = '+JSON.stringify(legacy)+';\n');await fs.writeFile(path.join(target,legacyName),legacyBytes);manifest.push({path:legacyName,access:'reviewer',bytes:legacyBytes.length});
await fs.writeFile(path.join(target,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${manifest.length} curated assets; protected pages/data require the Worker gateway.`);
