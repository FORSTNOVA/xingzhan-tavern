import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();
try{
 let id;
 for(let i=0;i<20&&!id;i++){
  for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault){try{if(await c.evaluate(`document.title==='TavernMark 酒馆排位赛'&&!!window.__TAVERNMARK`,ctx.id))id=ctx.id;}catch{}}
  if(!id)await new Promise(r=>setTimeout(r,500));
 }
 if(!id)throw new Error('Card not loaded');
 const frames=await c.evaluate(fs.readFileSync('scripts/probe-iframes.js','utf8'),id);
 fs.writeFileSync('artifacts/benchmark/iframe-probe-after.json',JSON.stringify(frames,null,2));
 if(!frames.every(f=>f.loaded&&f.script))throw new Error('Iframe probe failed');
 await c.evaluate(fs.readFileSync('scripts/benchmark-recheck.js','utf8'),id);
 const status=await c.evaluate(fs.readFileSync('scripts/benchmark-status.js','utf8'),id);
 fs.writeFileSync('artifacts/benchmark/preflight-after-fix.json',JSON.stringify(status,null,2));
 console.log(JSON.stringify({frames,focus:status.focus,parentFocus:status.parentFocus,issues:status.checks.items.filter(i=>['warn','bad'].includes(i.st)),floor:status.checks.items.find(i=>i.id==='G1'),log:status.log},null,2));
 if(status.checks.items.some(i=>['warn','bad'].includes(i.st)))throw new Error('Preflight not clean');
}finally{c.close()}
