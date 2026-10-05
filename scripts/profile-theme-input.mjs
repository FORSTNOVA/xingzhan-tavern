import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();
try{
 await c.call('Profiler.enable');await c.call('Profiler.start');
 const timing=await c.evaluate(`(async()=>{const area=document.querySelector('#send_textarea');const original=area.value;const timings=[];try{area.value='长文本输入验证。'.repeat(6250);for(let i=0;i<12;i++){await new Promise(r=>requestAnimationFrame(r));const start=performance.now();area.value+='字';area.dispatchEvent(new Event('input',{bubbles:true}));area.offsetHeight;timings.push(performance.now()-start);}}finally{area.value=original;area.dispatchEvent(new Event('input',{bubbles:true}));}return timings;})()`);
 const {profile}=await c.call('Profiler.stop');fs.writeFileSync('artifacts/theme/input-before.cpuprofile',JSON.stringify(profile));
 const top=profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,15).map(n=>({function:n.callFrame.functionName,url:n.callFrame.url,hits:n.hitCount,line:n.callFrame.lineNumber+1}));
 fs.writeFileSync('artifacts/theme/input-profile-summary.json',JSON.stringify({timing,top},null,2));console.log(JSON.stringify({timing,top}));
}finally{c.close()}
