import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';

const client=await connect();
try{
 const setup=await client.evaluate(`(async()=>{
  const panel=document.querySelector('#xingzhan-synthesis');if(!panel)throw Error('插件没有加载');
  const root=document.querySelector('#xingzhan-speech-dialog');if(!root)throw Error('前台配音窗口没有加载');
  const records=new Map();const calls={analysis:[],tts:[],models:0,save:[]},original=window.fetch,role='role-test-'+Date.now();
  const sample='旁白。你好！再见。';
  const buffer=new ArrayBuffer(44+16000*2/3),view=new DataView(buffer),bytes=new Uint8Array(buffer);
  const ascii=(offset,text)=>{for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);};
  ascii(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,buffer.byteLength-44,true);
  window.__xsTest={calls,original,root,sample,fixture:null,playEvents:0};
  window.fetch=async(url,options={})=>{
   const p=String(url);
   if(p.includes('/api/android/media/models/analysis')){calls.models++;return new Response(JSON.stringify({models:['test/text-model','another-text-model'],model:'test/text-model'}));}
   if(p.includes('/api/android/media/config/analysis')&&options.method==='POST'){const body=JSON.parse(options.body);calls.save.push(body);return new Response(JSON.stringify({...body,hasKey:true}));}
   if(p.includes('/api/android/media/sessions?'))return new Response(JSON.stringify({sessions:[...records.values()].map(x=>({id:x.id,text:x.text,updatedAt:new Date().toISOString(),audioCount:x.audio.length,total:3}))}));
   if(p.includes('/api/android/media/session/'))return new Response(JSON.stringify(records.get(p.split('/session/')[1].split('?')[0])));
   if(p.endsWith('/api/android/media/session')){const body=JSON.parse(options.body),old=records.get(body.id);body.audio=(old?.audio||[]).filter(x=>{const segment=body.result.segments[x.index];return segment&&x.voice===body.voices[segment.speakerId]&&x.style===[segment.emotion,segment.style].filter(Boolean).join('；');});records.set(body.id,body);return new Response(JSON.stringify(body));}
   if(p.includes('/api/android/media/analyze')){const body=JSON.parse(options.body);calls.analysis.push(body);const result={model:'test/text-model',segments:body.text===sample?[{text:'旁白。',type:'narration',speakerId:'narrator',emotion:'平静',style:'自然'},{text:'你好！',type:'dialogue',speakerId:role,emotion:'开心',style:'轻快地'},{text:'再见。',type:'dialogue',speakerId:role,emotion:'温柔',style:'柔和地'}]:[{text:body.text,type:'dialogue',speakerId:role,emotion:'平静',style:'自然'}],speakers:[{id:role,name:'测试角色',summary:'稳定音色',voiceSuggestion:'Puck'}]},id=crypto.randomUUID();records.set(id,{id,text:body.text,result,voices:{narrator:'Kore',[role]:'Puck'},audio:[],source:body.source});return new Response(JSON.stringify({...result,sessionId:id}));}
   if(p.includes('/api/android/media/generate-tts')){const body=JSON.parse(options.body);calls.tts.push(body);if(window.__xsTest.slow)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,2000);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));},{once:true});});records.get(body.sessionId).audio.push({index:body.segmentIndex,text:body.input.trim(),voice:body.voice,style:body.style,url:'data:audio/wav;base64,'+btoa(String.fromCharCode(...bytes))});return new Response(buffer.slice(0),{headers:{'Content-Type':'audio/wav'}});}
   if(p.includes('/api/android/media/memory'))return new Response(JSON.stringify({schemaVersion:1,characters:[]}));
   return original.call(window,url,options);
  };
  const config=panel.querySelector('[data-kind="analysis"]');config.querySelector('[data-action="models"]').click();await new Promise(r=>setTimeout(r,100));
  const model=config.querySelector('[data-field="model"]');if(![...model.options].some(x=>x.value==='test/text-model'))throw Error('上游模型未填入下拉框');model.value='test/text-model';model.dispatchEvent(new Event('change'));config.querySelector('[data-action="save"]').click();await new Promise(r=>setTimeout(r,100));if(calls.save[0]?.model!=='test/text-model')throw Error('未保存自行选择的模型');
  const fixture=document.createElement('div');fixture.className='mes';fixture.setAttribute('mesid','-1');fixture.setAttribute('ch_name','配音测试');fixture.innerHTML='<div class="mes_block"><div class="mes_buttons"></div><div class="mes_text"></div></div>';fixture.querySelector('.mes_text').textContent=sample;document.querySelector('#chat').append(fixture);window.__xsTest.fixture=fixture;
  await new Promise(r=>setTimeout(r,200));const action=fixture.querySelector('[data-xs-speech]');if(!action)throw Error('聊天消息没有配音按钮');action.click();await new Promise(r=>setTimeout(r,150));
  if(!root.open||root.querySelector('[data-speech-text]').value!==sample||root.querySelector('[data-scope]').value!=='full')throw Error('整条消息未带入前台窗口');
  root.querySelector('[data-remember]').checked=false;root.querySelector('[data-analyze]').click();await new Promise(r=>setTimeout(r,150));if(calls.analysis.length!==1||calls.tts.length)throw Error('分析阶段不应调用 TTS');
  const generate=root.querySelector('[data-generate]');generate.click();for(let i=0;i<80&&root.querySelector('[data-play]').disabled;i++)await new Promise(r=>setTimeout(r,50));
  if(generate.disabled||root.querySelector('[data-play]').disabled)throw Error('生成后生成/播放按钮仍被禁用');
  if(calls.tts.length!==3||calls.tts[1].voice!=='Puck'||calls.tts[2].voice!=='Puck')throw Error('同一角色音色没有保持一致');
  const audio=root.querySelector('audio');audio.addEventListener('play',()=>window.__xsTest.playEvents++);
  return {wholeMessage:true,modelSelection:true,enabledPlay:true,ttsCalls:calls.tts.length};
 })()`);
 assert.ok(setup.wholeMessage&&setup.enabledPlay&&setup.modelSelection);
 // A real browser gesture plays short silent WAVs, so playback is verified without upstream calls or sound.
 await client.call('Runtime.evaluate',{expression:`document.querySelector('#xingzhan-speech-dialog [data-play]').click()`,userGesture:true});
 await new Promise(r=>setTimeout(r,130));
 await client.evaluate(`document.querySelector('#xingzhan-speech-dialog [data-pause]').click()`);
 const paused=await client.evaluate(`document.querySelector('#xingzhan-speech-dialog audio').paused`);assert.equal(paused,true);
 await client.call('Runtime.evaluate',{expression:`document.querySelector('#xingzhan-speech-dialog [data-play]').click()`,userGesture:true});
 for(let retry=0;retry<80;retry++){if(await client.evaluate(`document.querySelector('#xingzhan-speech-dialog [data-tts-status]').textContent.includes('连续播放完成')`))break;await new Promise(r=>setTimeout(r,100));}
 const result=await client.evaluate(`(async()=>{
  const t=window.__xsTest,status=t.root.querySelector('[data-tts-status]').textContent;
  if(!status.includes('连续播放完成'))throw Error('连续播放未结束：'+status);
  if(t.calls.tts.length!==3)throw Error('播放时重复请求 TTS');
  const style=t.root.querySelector('[data-style]');style.value='测试取消';style.dispatchEvent(new Event('input'));t.slow=true;t.root.querySelector('[data-generate]').click();await new Promise(r=>setTimeout(r,100));t.root.querySelector('[data-stop]').click();await new Promise(r=>setTimeout(r,150));
  if(t.root.querySelector('[data-generate]').disabled||t.calls.tts.length!==4)throw Error('取消后按钮未恢复或继续发起请求');t.slow=false;
  t.root.close();const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js');await m.openSpeech({text:'你好！',fullText:t.sample,scope:'selection',context:[]});
  const scope=t.root.querySelector('[data-scope]');scope.value='full';scope.dispatchEvent(new Event('change'));if(t.root.querySelector('[data-speech-text]').value!==t.sample)throw Error('选区不能切换为整条消息');
  return {wholeMessage:true,selectionToWhole:true,modelSelection:true,playButtonEnabled:true,pauseResume:true,continuousPlayback:true,cancelStopsRequests:true,playEvents:t.playEvents,completedTtsCalls:3,cancelledTtsCalls:1,upstream:'all generation mocked; silent WAV playback'};
 })()`);
 fs.writeFileSync('artifacts/relay/context-synthesis-'+(process.argv.includes('--phone')?'phone':'emulator')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
 await client.evaluate(`(()=>{const t=window.__xsTest;if(t){t.root.close();window.fetch=t.original;t.fixture?.remove();delete window.__xsTest;}})()`).catch(()=>{});
 await client.call('Page.reload').catch(()=>{});
 client.close();
}
