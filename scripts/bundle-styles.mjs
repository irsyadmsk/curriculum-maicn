import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../irsyads/package.json',import.meta.url));
const {transform}=require('esbuild');

// Only join consecutive local stylesheet runs. Inline styles, scripts and remote
// stylesheets are boundaries, so the original cascade and script order survive.
export async function bundleStyles(html,{root,target,manifest}){
 const groups=[];let group=[];
 const flush=()=>{if(group.length>1)groups.push(group);group=[]};
 const tags=/<link\b[^>]*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
 for(const match of html.matchAll(tags)){
  const tag=match[0],href=/\bhref=["']([^"']+)["']/i.exec(tag)?.[1],rel=/\brel=["']([^"']+)["']/i.exec(tag)?.[1];
  if(/^<link/i.test(tag)&&rel==='stylesheet'&&href?.startsWith('assets/')&&/\.css(?:\?|$)/.test(href)&&!/(?:\bmedia|\bdisabled|\bintegrity)\s*=/i.test(tag))group.push({start:match.index,end:match.index+tag.length,name:href.split('?')[0]});
  else flush();
 }flush();
 const edits=[];
 for(const run of groups){
  const chunks=[];
  for(const item of run){const absolute=path.resolve(root,item.name);if(!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Invalid stylesheet path');let css=await fs.readFile(absolute,'utf8');
   // Bundles live directly in assets/. Preserve relative asset paths from subdirs.
   css=css.replace(/url\(\s*(["']?)([^\s'"()]+)\1\s*\)/g,(original,quote,url)=>{if(/^(?:[a-z]+:|\/|#)/i.test(url))return original;const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(item.name),url));return `url("${path.posix.relative('assets',resolved)}")`});chunks.push(css);
  }
  const result=await transform(chunks.join('\n'),{loader:'css',minify:true,target:['chrome90','safari15'],legalComments:'none'});
  if(result.warnings.length)throw Error('Stylesheet compilation: '+result.warnings.map(w=>w.text).join('; '));
  const name='assets/layout-'+createHash('sha256').update(result.code).digest('hex').slice(0,12)+'.css';
  if(!manifest.some(row=>row.path===name)){await fs.mkdir(path.join(target,'assets'),{recursive:true});await fs.writeFile(path.join(target,name),result.code);manifest.push({path:name,access:'public',bytes:Buffer.byteLength(result.code)})}
  edits.push({start:run[0].start,end:run[0].end,text:`<link rel="stylesheet" href="${name}">`});for(const item of run.slice(1))edits.push({...item,text:''});
 }
 for(const edit of edits.sort((a,b)=>b.start-a.start))html=html.slice(0,edit.start)+edit.text+html.slice(edit.end);
 return html;
}
