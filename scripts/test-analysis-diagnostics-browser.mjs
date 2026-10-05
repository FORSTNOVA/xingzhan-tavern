import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();
try{
 const result=await c.evaluate(`(async()=>{
 const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js'),original=window.fetch,host=document.createElement('div');host.innerHTML='<details><pre data-analysis-log-output></pre></details>';const record={id:'this-failure',coverage:{missing:[3],duplicates:[{id:5,count:2}]}};let calls=0;
 try{window.fetch=async(url)=>{calls++;if(String(url).includes('analysis-diagnostics'))return new Response(JSON.stringify({records:[{id:'old-request',body:'旧日志'},record]}));return new Response(JSON.stringify({error:'模拟漏号',diagnosticId:'this-failure',diagnosticsSaved:true,coverageDetails:record.coverage}),{status:502});};let error;try{await m.mediaRequest('analyze',{text:'模拟正文'});}catch(e){error=e;}if(error?.diagnosticId!=='this-failure'||error.coverageDetails.missing[0]!==3)throw Error('错误元数据丢失');await m.showAnalysisFailureDiagnostic(host,error,{id:'fixture'});if(!host.querySelector('details').open||host.textContent.includes('old-request')||!host.textContent.includes('this-failure'))throw Error('未显示本次记录');await m.showAnalysisFailureDiagnostic(host,{diagnosticId:'missing-record'},{id:'fixture'});if(!host.textContent.includes('未找到')||host.textContent.includes('old-request'))throw Error('误展示旧记录');host.querySelector('pre').textContent='保留当前面板';await m.showAnalysisFailureDiagnostic(host,error,{id:'fixture'},()=>false);if(host.textContent!=='保留当前面板')throw Error('过期结果覆盖面板');return {metadata:true,exactRequest:true,missingRecord:true,staleGuard:true,mockedRequests:calls};}finally{window.fetch=original;}
 })()`);
 assert.ok(result.metadata&&result.exactRequest&&result.missingRecord&&result.staleGuard);
 fs.writeFileSync('artifacts/tts-probe/analysis-diagnostics-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close();}
