import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const c=await connect();
try{
 const result=await c.evaluate(`(async()=>{
 const original=window.fetch,records=new Map(),text='正文。'.repeat(4500),scope={id:'card:long-analysis-test',label:'超长分析验证'};let calls=0;
 window.fetch=async(url,options={})=>{const p=String(url),body=options.body?JSON.parse(options.body):{};
  if(p.includes('/api/android/media/memory'))return new Response(JSON.stringify({characters:[]}));
  if(p.includes('/api/android/media/sessions?'))return new Response(JSON.stringify({sessions:[]}));
  if(p.includes('/api/android/media/analysis-progress/'))return new Response(JSON.stringify({completed:1,total:3,state:'running'}));
  if(p.includes('/api/android/media/session/'))return new Response(JSON.stringify(records.get(p.split('/session/')[1].split('?')[0])));
  if(p.endsWith('/api/android/media/session')){records.set(body.id,body);return new Response(JSON.stringify(body));}
  if(p.includes('/api/android/media/analyze')){calls++;if(body.text!==text)throw Error('超长文本被截断');await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,2300);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));},{once:true});});const id=crypto.randomUUID(),result={model:'mock',analysisChunks:3,segments:[{text:text.slice(0,6000),type:'narration',speakerId:'narrator'},{text:text.slice(6000,12000),type:'narration',speakerId:'narrator'},{text:text.slice(12000),type:'narration',speakerId:'narrator'}],speakers:[]};records.set(id,{id,text,result,voices:{narrator:'Kore'},audio:[]});return new Response(JSON.stringify({...result,sessionId:id}));}
  return original.call(window,url,options);
 };
 const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js'),root=document.querySelector('#xingzhan-speech-dialog');
 try{await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope,context:[]});root.querySelector('[data-analyze]').click();await new Promise(r=>setTimeout(r,1800));if(!root.querySelector('[data-analysis-status]').textContent.includes('1/3'))throw Error('未显示分批进度');await new Promise(r=>setTimeout(r,900));if(root.querySelector('[data-review]').hidden||!root.querySelector('[data-analysis-status]').textContent.includes('3 批已合并'))throw Error('长文本分析结果未展示');
 const field=root.querySelector('[data-speech-text]');field.value='甲'.repeat(120001);field.dispatchEvent(new Event('input'));root.querySelector('[data-analyze]').click();if(calls!==1||!root.querySelector('[data-analysis-status]').textContent.includes('120000'))throw Error('整篇上限检查失败');return {longTextNotTruncated:true,progressVisible:true,mergedReviewVisible:true,totalLimitWithoutRequest:true,calls};
 }finally{root.close();await new Promise(r=>setTimeout(r,200));window.fetch=original;}
 })()`);assert.equal(result.calls,1);console.log(JSON.stringify(result,null,2));
}finally{c.close();}
