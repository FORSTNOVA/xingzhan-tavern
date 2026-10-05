import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const c=await connect();
const out=process.env.PERFORMANCE_VALIDATION_DIR || 'artifacts/performance';
fs.mkdirSync(out,{recursive:true});
try {
 const before=await c.evaluate('window.__apkMobilePerformance?.status()');
 assert.equal(before?.enabled,true);
 await c.call('Page.reload');
 let after;
 for(let i=0;i<60;i++) {
  await new Promise(r=>setTimeout(r,500));
  try {after=await c.evaluate('window.__apkMobilePerformance?.status()');} catch {}
  if(after?.enabled)break;
 }
 assert.equal(after?.enabled,true);
 assert.equal(after.settings.chat_truncation,30);
 const result={before,after,passed:true,checkedAt:new Date().toISOString()};
 fs.writeFileSync(out+'/native-persistence.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {c.close();}
