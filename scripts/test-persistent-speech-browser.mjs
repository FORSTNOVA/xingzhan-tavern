import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();
try{
 await c.evaluate(`(async()=>{for(let i=0;i<100;i++){if(document.querySelector('#xingzhan-speech-dialog'))return;await new Promise(r=>setTimeout(r,100));}throw Error('配音插件尚未加载');})()`);
 const result=await c.evaluate(`(async()=>{
 const original=window.fetch,records=new Map(),calls={analysis:0,tts:0},scope={id:'card:storage-test',label:'保存验证'},text='旁白。你好！';
 const bytes=new Uint8Array(44+3200),v=new DataView(bytes.buffer),ascii=(o,s)=>{for(let i=0;i<s.length;i++)bytes[o+i]=s.charCodeAt(i);};ascii(0,'RIFF');v.setUint32(4,bytes.length-8,true);ascii(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ascii(36,'data');v.setUint32(40,3200,true);const audioUrl='data:audio/wav;base64,'+btoa(String.fromCharCode(...bytes));
 let failSecond=true;const json=x=>new Response(JSON.stringify(x));
 window.fetch=async(url,options={})=>{const p=String(url),body=options.body?JSON.parse(options.body):{};
 if(p.includes('/api/android/media/memory'))return json({characters:[]});
 if(p.includes('/api/android/media/sessions?'))return json({sessions:[...records.values()].map(x=>({id:x.id,text:x.text,updatedAt:new Date().toISOString(),audioCount:x.audio.length,total:2}))});
 if(p.includes('/api/android/media/session/'))return json(records.get(p.split('/session/')[1].split('?')[0]));
 if(p.endsWith('/api/android/media/session')){const previous=records.get(body.id);body.audio=(previous?.audio||[]).filter(x=>x.voice===body.voices[body.result.segments[x.index].speakerId]);records.set(body.id,body);return json(body);}
 if(p.includes('/api/android/media/analyze')){calls.analysis++;const id=crypto.randomUUID(),result={model:'mock',speakers:[{id:'alice',name:'爱丽丝',voiceSuggestion:'Puck'}],segments:[{text:'旁白。',type:'narration',speakerId:'narrator',emotion:'平静',style:'自然'},{text:'你好！',type:'dialogue',speakerId:'alice',emotion:'开心',style:'轻快'}]};records.set(id,{id,text,result,voices:{narrator:'Kore',alice:'Puck'},source:body.source,audio:[]});return json({...result,sessionId:id});}
 if(p.includes('/api/android/media/generate-tts')){calls.tts++;if(body.segmentIndex===1&&failSecond)return new Response(JSON.stringify({error:'模拟第二段失败'}),{status:502});const record=records.get(body.sessionId);record.audio.push({index:body.segmentIndex,text:body.input.trim(),voice:body.voice,style:body.style,url:audioUrl});return new Response(bytes,{headers:{'Content-Type':'audio/wav'}});}
 return original.call(window,url,options);};
 const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js'),root=document.querySelector('#xingzhan-speech-dialog');
 try{
 await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope,context:[]});root.querySelector('[data-remember]').checked=false;root.querySelector('[data-analyze]').click();
 const wait=async f=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,30));}throw Error('等待超时');};await wait(()=>root.querySelector('[data-generate]')&&!root.querySelector('[data-review]').hidden);
 root.querySelector('[data-generate]').click();await wait(()=>root.querySelector('[data-tts-status]').textContent.includes('失败'));if([...records.values()][0].audio.length!==1)throw Error('第一段没有保留');
 root.close();await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope,context:[]});if(calls.analysis!==1||root.querySelector('[data-play]').disabled)throw Error('部分结果未恢复');
 failSecond=false;root.querySelector('[data-generate]').click();await wait(()=>root.querySelector('[data-generate]').dataset.ready==='1');if(calls.tts!==3)throw Error('补齐时重复生成第一段');
 root.close();await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope,context:[]});if(root.querySelector('[data-play]').disabled||calls.tts!==3)throw Error('完整结果恢复失败');
 root.querySelector('[data-generate]').click();await wait(()=>!root.querySelector('[data-generate]').disabled);if(calls.tts!==3)throw Error('缓存音频被重复请求');
 const select=root.querySelector('.xs-profile select');select.value='Zephyr';select.dispatchEvent(new Event('change'));root.close();await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope,context:[]});if(root.querySelector('.xs-profile select').value!=='Zephyr')throw Error('退出前编辑没有保存');
 return {analysisAutomaticallySaved:true,partialAudioRestored:true,resumeOnlyMissing:true,fullAudioRestored:true,noRepeatGeneration:true,voiceEditSavedOnClose:true,calls};
 }finally{root.close();await new Promise(r=>setTimeout(r,200));window.fetch=original;}
 })()`);assert.equal(result.calls.analysis,1);assert.equal(result.calls.tts,3);fs.writeFileSync('artifacts/relay/persistent-speech-'+(process.argv.includes('--phone')?'phone':'emulator')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close();}
