import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {connect} from './webview-cdp.mjs';
const out=process.env.TAVERN_BENCHMARK_DIR || 'artifacts/benchmark';
fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:19787';
const csrf=await fetch(base+'/csrf-token');
const {token}=await csrf.json();
const cookie=csrf.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const response=await fetch(base+'/api/characters/export',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token,Cookie:cookie},body:JSON.stringify({avatar_url:'TavernMark 酒馆排位赛.png',format:'json'})});
if(!response.ok)throw new Error('Card export failed '+response.status);
const current=await response.json();
const original=JSON.parse(fs.readFileSync('artifacts/benchmark/original-card.json','utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const integrity={originalRegexSha256:hash(original.data.extensions.regex_scripts),currentRegexSha256:hash(current.data.extensions.regex_scripts),firstMessageUnchanged:original.data.first_mes===current.data.first_mes};
integrity.regexUnchanged=integrity.originalRegexSha256===integrity.currentRegexSha256;
fs.writeFileSync(out+'/card-integrity.json',JSON.stringify(integrity,null,2));
if(!integrity.regexUnchanged || !integrity.firstMessageUnchanged)throw new Error('Benchmark card changed');
const c=await connect();
try{
 for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault && await c.evaluate(`document.title==='TavernMark 酒馆排位赛'`,ctx.id)){
  const state=await c.evaluate(`({running:getComputedStyle(document.querySelector('#tmRun')).display!=='none',result:window.__TM_LAST__,text:document.body.innerText,log:window.__TAVERNMARK.log()})`,ctx.id);
  if(state.running || !state.result || Object.values(state.result.rounds).some(r=>r.invalid))throw new Error('Run incomplete');
  fs.writeFileSync(out+'/completed-state.json',JSON.stringify(state,null,2));
  fs.writeFileSync(out+'/standard-result-text.txt',state.text);
 }
 await c.evaluate(`document.querySelector('#chat').scrollTop=0; true`);
 await new Promise(r=>setTimeout(r,300));
 if(process.env.TAVERN_BENCHMARK_SKIP_SCREENSHOT!=='1') {
  const shot=await c.call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(out+'/result-webview.png',Buffer.from(shot.data,'base64'));
 }
 console.log(JSON.stringify(integrity));
}finally{c.close()}
