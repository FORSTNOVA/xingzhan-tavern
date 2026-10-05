import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const c=await connect();
try{
 const result=await c.evaluate(`(async()=>{
 const media=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js'),m=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js'),{extension_settings}=await import('/scripts/extensions.js');
 window.__partialTest={settings:structuredClone(extension_settings.xingzhanSynthesis),fetch:window.fetch};const originalFetch=window.fetch;let requests=0,requestRange;
 const scope={id:'card:partial-ui-'+Date.now(),label:'片段内分析界面验证'},text='前文。需要纠正。后文。',saved=await media.saveSpeechSession({text,result:{speakers:[],segments:[{text,type:'narration',speakerId:'narrator'}]},voices:{narrator:'Kore'}},scope);extension_settings.xingzhanSynthesis.speechProvider='api';
 window.fetch=async(url,opt)=>{
  if(/\\/media\\/(analyze|generate-tts|generate-image)/.test(String(url)))throw Error('禁止收费接口');
  if(String(url).endsWith('/media/reanalyze')){
   requests++;const body=JSON.parse(opt.body);requestRange=body.range;if(!requestRange||requestRange.start!==3||requestRange.end!==8)throw Error('选区请求不一致');
   const record=await media.loadSpeechSession(body.sessionId,scope),old=structuredClone(record.result),segment=record.result.segments[0],r=body.range;
   record.result.segments=[{...segment,text:text.slice(0,r.start)},{...segment,text:text.slice(r.start,r.end),emotion:'开心',manualEdited:false},{...segment,text:text.slice(r.end)}];
   record.result.reviewHistory=[{...media.speechReviewSnapshot(old,'局部重新分析'),fullSegments:old.segments}];record.result.reviewNotice='模拟局部分析已保存';
   const stored=await media.saveSpeechSession(record,scope);return new Response(JSON.stringify({...stored,localAnalysisIndices:[1],localAnalysisCalls:1}),{headers:{'Content-Type':'application/json'}});
  }return originalFetch.call(window,url,opt);
 };
 await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope});let root=document.querySelector('#xingzhan-speech-dialog');const field=root.querySelector('[data-local-text]');if(!field.readOnly)throw Error('正文不是只读');field.setSelectionRange(3,8);root.querySelector('[data-local-range-plan]').click();
 for(let i=0;i<30&&root.querySelector('[data-local-run]').disabled;i++)await new Promise(r=>setTimeout(r,100));
 const preview=root.querySelector('[data-local-plan-status]').textContent;if(!preview.includes('需要纠正。')||!preview.includes('1 次文本请求'))throw Error('预览范围或调用数不正确');if(requests)throw Error('预览触发分析');
 root.querySelector('[data-local-run]').click();for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));if(root.querySelectorAll('[data-local-text]').length===3)break;}
 let record=await media.loadSpeechSession(saved.id,scope);if(record.result.segments.length!==3||record.result.segments.map(x=>x.text).join('')!==text)throw Error('拆分保存不正确');
 root.close();await new Promise(r=>setTimeout(r,200));await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope});root=document.querySelector('#xingzhan-speech-dialog');const restored=root.querySelectorAll('[data-local-text]').length===3;
 root.querySelector('[data-review-undo]').click();await new Promise(r=>setTimeout(r,800));record=await media.loadSpeechSession(saved.id,scope);if(record.result.segments.length!==1||record.result.segments[0].text!==text)throw Error('结构撤销失败');
 return {readOnly:true,preview:true,previewNoAnalysis:true,rangeSent:true,splitSaved:true,closeRestore:restored,structuralUndo:true,simulatedAnalysisRequests:requests,paidRequests:0};})()`);
 for(const [key,value] of Object.entries(result))if(typeof value==='boolean')assert.equal(value,true,key);assert.equal(result.simulatedAnalysisRequests,1);
 fs.writeFileSync('artifacts/tts-probe/subsegment-'+(process.env.WEBVIEW_CDP_URL?'emulator':'phone')+'.json',JSON.stringify(result,null,2));console.log(result);
}finally{
 await c.evaluate(`(async()=>{const state=window.__partialTest;if(!state)return;window.fetch=state.fetch;document.querySelector('#xingzhan-speech-dialog')?.close();const {extension_settings}=await import('/scripts/extensions.js'),{saveSettingsDebounced}=await import('/script.js');const settings=extension_settings.xingzhanSynthesis;for(const key of Object.keys(settings))delete settings[key];Object.assign(settings,state.settings);saveSettingsDebounced();delete window.__partialTest;})()`).catch(()=>{});c.close();
}
