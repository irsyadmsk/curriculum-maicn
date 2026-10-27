import {accessReady,access} from './curriculum-access.mjs';
await accessReady;
if(access.has('teacher')){const script=document.createElement('script');script.src='assets/report-roster.js?v=20261026-audience1';document.body.append(script);}
