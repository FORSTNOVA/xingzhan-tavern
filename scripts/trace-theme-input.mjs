import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();const trace=[];let finished;
const done=new Promise(resolve=>finished=resolve);
c.onEvent(event=>{if(event.method==='Tracing.dataCollected')trace.push(...event.params.value);if(event.method==='Tracing.tracingComplete')finished();});
try{
 await c.call('Tracing.start',{categories:'devtools.timeline,blink,disabled-by-default-devtools.timeline',options:'record-as-much-as-possible'});
 const timing=await c.evaluate(`(async()=>{const area=document.querySelector('#send_textarea');const original=area.value;const timings=[];try{area.value='长文本输入验证。'.repeat(6250);for(let i=0;i<8;i++){await new Promise(r=>requestAnimationFrame(r));const start=performance.now();area.value+='字';area.dispatchEvent(new Event('input',{bubbles:true}));area.offsetHeight;timings.push(performance.now()-start);}}finally{area.value=original;area.dispatchEvent(new Event('input',{bubbles:true}));}return timings;})()`);
 await c.call('Tracing.end');await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Trace timeout')),15000))]);
 fs.writeFileSync('artifacts/theme/input-trace.json',JSON.stringify({traceEvents:trace}));
 const grouped={};for(const e of trace)if(e.ph==='X'&&e.dur){const row=grouped[e.name]??={count:0,totalMs:0,maxMs:0};row.count++;row.totalMs+=e.dur/1000;row.maxMs=Math.max(row.maxMs,e.dur/1000);}
 const top=Object.entries(grouped).sort((a,b)=>b[1].totalMs-a[1].totalMs).slice(0,25);fs.writeFileSync('artifacts/theme/input-trace-summary.json',JSON.stringify({timing,top},null,2));console.log(JSON.stringify({timing,top}));
}finally{c.close()}
