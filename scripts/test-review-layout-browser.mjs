import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();
try{
 const result=await c.evaluate(`(async()=>{
  for(let i=0;i<100&&!document.querySelector('#xingzhan-speech-dialog');i++)await new Promise(r=>setTimeout(r,100));
  const plugin=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js'),media=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js'),{extension_settings}=await import('/scripts/extensions.js');
  const settings=extension_settings.xingzhanSynthesis,previous=settings.speechProvider,scope={id:'card:review-layout-test-'+Date.now(),label:'审核页面布局验证'},segments=Array.from({length:60},(_,i)=>({text:'第'+(i+1)+'段布局验证正文。',type:'narration',speakerId:'narrator',emotion:'平静',style:'自然',system:{voice:'布局验证音色',rate:1,pitch:1,pauseMs:200}})),text=segments.map(x=>x.text).join(''),plan={model:'本地布局测试',speakers:[{id:'narrator',name:'旁白'}],segments},root=document.querySelector('#xingzhan-speech-dialog'),checks=[];
  try{for(const provider of ['api','system']){
   settings.speechProvider=provider;
   const saved=await media.saveSpeechSession({text,result:plan,voices:{narrator:provider==='api'?'Kore':'layout-voice'},...(provider==='system'?{provider:'system',system:{engine:'layout-test-engine',voice:'布局验证音色',rate:1,pitch:1,contextual:true}}:{})},scope);
   await plugin.openSpeech({text,fullText:text,scope:'full',cardScope:scope});
   const body=root.querySelector('[data-speech-workspace]'),header=root.querySelector('.xs-dialog-heading'),close=root.querySelector('[data-close]'),page=root.querySelector('[data-review-page]'),main=root.querySelector('[data-speech-main]');
   if(page.hidden||!main.hidden||root.querySelector('[data-review-back]').hidden)throw Error(provider+'没有进入二级审核页');
   const filter=root.querySelector((provider==='api'?'[data-review]':'[data-system-review]')+' [data-review-filter]');filter.value='all';filter.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,200));
   const top=header.getBoundingClientRect().top;body.scrollTop=body.scrollHeight;await new Promise(r=>requestAnimationFrame(r));
   if(body.scrollTop<100||Math.abs(header.getBoundingClientRect().top-top)>1||close.getBoundingClientRect().bottom>innerHeight)throw Error(provider+'冻结外框滚动失败');
   const review=root.querySelector(provider==='api'?'[data-review]':'[data-system-review]');
   const generate=root.querySelector(provider==='api'?'[data-generate]':'[data-system-generate]');if(!main.contains(generate)||page.contains(generate))throw Error('生成没有放在一级页面');
   if(review.querySelectorAll('.xs-segment').length!==60)throw Error('长列表不完整');
   root.querySelector('[data-review-back]').click();if(main.hidden||!page.hidden)throw Error('返回未切换页面');
   root.querySelector('[data-open-review]').click();if(page.hidden||review.querySelectorAll('.xs-segment').length!==60)throw Error('返回后结果丢失');
   root.querySelector('[data-close]').click();if(root.open)throw Error('关闭失败');
   const restored=await media.loadSpeechSession(saved.id,scope);if(restored.result.segments.length!==60)throw Error('关闭后记录丢失');
   checks.push({provider,segments:60,frozenHeader:true,secondaryPage:true,generationOnMain:true,backPreservesResult:true,closePreservesRecord:true});
  }}finally{settings.speechProvider=previous;if(root.open)root.close();}
  return {checks,paidRequests:0};
 })()`);
 assert.equal(result.checks.length,2);fs.mkdirSync('artifacts/tts-probe',{recursive:true});fs.writeFileSync('artifacts/tts-probe/review-layout-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close();}
