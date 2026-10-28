/** Prepare a PRIVATE seed for authorized activation. Never contacts a database. */
import fs from 'node:fs/promises';
const source=new URL('../private-inputs/curriculum-content.json',import.meta.url),target=new URL('../private-inputs/curriculum-content-seed.sql',import.meta.url);
const data=JSON.parse(await fs.readFile(source,'utf8'));
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
if(data.version!==1||!Array.isArray(data.records)||data.records.length<1)throw Error('Invalid content input');
const lines=['-- PRIVATE owner content. Manual activation only after owner approval.','begin;'];
for(const r of data.records)lines.push(`insert into private.curriculum_content(id,kind,source,content) values(${quote(r.id)},${quote(r.kind)},${quote(JSON.stringify(r.source))}::jsonb,${quote(JSON.stringify(r.content))}::jsonb) on conflict(id) do nothing;`);
lines.push('commit;');await fs.writeFile(target,lines.join('\n')+'\n');console.log(`Prepared ${data.records.length} private records. Existing edits will not be overwritten.`);
