import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const out=process.env.TAVERN_BENCHMARK_DIR || 'artifacts/benchmark';
fs.mkdirSync(out,{recursive:true});
const c=await connect();
try{
 let contextId;
 for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault){try{if(await c.evaluate(`document.title==='TavernMark 酒馆排位赛' && !!window.__TAVERNMARK`,ctx.id))contextId=ctx.id;}catch{}}
 if(!contextId)throw new Error('Benchmark context not found');
 const before=await c.evaluate(`({checks:window.__TAVERNMARK.checks(),log:window.__TAVERNMARK.log(),wakeLock:!!navigator.wakeLock,running:getComputedStyle(document.querySelector('#tmRun')).display!=='none'})`,contextId);
 if(!before.running){
  fs.writeFileSync(out+'/before-standard-run.json',JSON.stringify(before,null,2));
  const allowedWarnings=(process.env.TAVERN_BENCHMARK_ALLOW_WARNINGS || '').split(',').filter(Boolean);
  if(before.checks.items.some(i=>i.st==='bad' || (i.st==='warn' && !allowedWarnings.includes(i.id))))throw new Error('Preflight has outstanding issues');
  if(allowedWarnings.length)console.log(JSON.stringify({retainedWarnings:before.checks.items.filter(i=>i.st==='warn')}));
  await c.evaluate(`window.__APK_BENCH_PREVIOUS_RESULT__=window.__TM_LAST__;document.querySelector('[data-mode="standard"]').click(); document.querySelector('[data-act="run"]').click(); true`,contextId);
 }else console.log('Attached to the standard run already in progress');
 let result;
 for(let i=0;i<24;i++){
  await new Promise(r=>setTimeout(r,15000));
  const status=await c.evaluate(`({text:document.querySelector('#tmRun')?.innerText,log:window.__TAVERNMARK.log().slice(-4),result:window.__TM_LAST__!==window.__APK_BENCH_PREVIOUS_RESULT__?window.__TM_LAST__:null,body:document.body.innerText.slice(-10000)})`,contextId);
  fs.writeFileSync(out+'/run-progress.json',JSON.stringify(status,null,2));
  console.log(JSON.stringify({elapsedSec:(i+1)*15,text:status.text?.slice(0,600),log:status.log}));
  if(status.result){result=status.result;fs.writeFileSync(out+'/standard-result.json',JSON.stringify(result,null,2));fs.writeFileSync(out+'/standard-result-text.txt',status.body);break;}
  if(status.log.some(l=>['run-error','cancel'].includes(l.k)))throw new Error('Benchmark stopped: '+JSON.stringify(status.log));
 }
 if(!result)throw new Error('No result after six minutes');
 const feedback=await c.evaluate(`window.__TAVERNMARK.feedback()`,contextId);
 fs.writeFileSync(out+'/standard-feedback.json',JSON.stringify(feedback,null,2));
 console.log(JSON.stringify({finished:true,peak:result.peak,mode:result.mode,ranked:result.ranked,axes:result.axes,flags:result.flags,unrankedWhy:result.unrankedWhy,rounds:Object.fromEntries(Object.entries(result.rounds).map(([id,r])=>[id,{score:r.score,invalid:r.invalid,invalidWhy:r.invalidWhy}]))}));
}finally{c.close()}
