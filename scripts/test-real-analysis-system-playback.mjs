import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const report=JSON.parse(fs.readFileSync('artifacts/tts-evaluation/live-2026-10-04T09-38-00-477Z/report.json','utf8'));
const sample=report.records.find(r=>r.id==='natural-user-not-character');
assert.equal(sample.status,200);const c=await connect();
try{
 const setup=await c.evaluate(`(async()=>{
 const plan=${JSON.stringify(sample.result)},text=plan.segments.map(x=>x.text).join(''),media=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js'),m=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js'),{extension_settings}=await import('/scripts/extensions.js');
 const settings=extension_settings.xingzhanSynthesis,previous=JSON.parse(JSON.stringify(settings)),originalFetch=window.fetch,originalPrompt=window.prompt,scope={id:'card:real-analysis-playback-'+Date.now(),label:'真实分析结果系统配音验收'},calls={cachedAnalysis:0,paid:0,native:[]};
 window.__realPlayback={settings,previous,originalFetch,originalPrompt,scope,calls,plan,text};
 window.fetch=async(url,options)=>{if(String(url).endsWith('/api/android/media/analyze')){calls.cachedAnalysis++;const saved=await media.saveSpeechSession({text,result:plan,voices:{narrator:'Kore'}},scope);return new Response(JSON.stringify({...plan,sessionId:saved.id}));}if(String(url).includes('/api/android/media/generate-tts')||String(url).includes('/api/android/media/generate-image')){calls.paid++;throw Error('验收禁止收费生成');}return originalFetch.call(window,url,options);};
 window.prompt=(message,value)=>{if(message.startsWith('__xingzhan_system_tts__:')){const body=JSON.parse(message.slice('__xingzhan_system_tts__:'.length));if(body.action==='synthesize')calls.native.push(body);}return originalPrompt.call(window,message,value);};
 settings.speechProvider='system';await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope});const root=document.querySelector('#xingzhan-speech-dialog'),t=window.__realPlayback;t.root=root;t.wait=async check=>{for(let i=0;i<500;i++){if(check())return;await new Promise(r=>setTimeout(r,40));}throw Error(root.querySelector('[data-system-status]').textContent);};
 root.querySelector('[data-system-detect]').click();await t.wait(()=>!root.querySelector('[data-system-detect]').disabled);
 root.querySelector('[data-system-analyze]').click();await t.wait(()=>!root.querySelector('[data-system-analyze]').disabled&&!root.querySelector('[data-system-review]').hidden);
 const records=await media.listSpeechSessions(scope);t.record=await media.loadSpeechSession(records.sessions.find(x=>x.provider==='system').id,scope);
 if(t.record.text!==text||t.record.result.segments.map(x=>x.text).join('')!==text)throw Error('真实分析结果丢失正文');
 root.querySelector('[data-system-audio]').volume=0;root.querySelector('[data-system-generate]').click();await t.wait(()=>!root.querySelector('[data-system-generate]').disabled);
 const saved=await media.loadSpeechSession(t.record.id,scope),spoken=plan.segments.filter(x=>['narration','dialogue'].includes(x.type));if(saved.audio.length!==spoken.length||calls.native.length!==spoken.length)throw Error('系统音频段数错误');if(calls.native.some((x,i)=>x.text!==spoken[i].text))throw Error('生成正文夹带提示词或漏读');
 for(const clip of saved.audio){const bytes=new Uint8Array(await(await originalFetch.call(window,clip.url)).arrayBuffer());if(String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||bytes.length<=44)throw Error('生成的 WAV 无效');}
 root.querySelector('[data-system-generate]').click();await t.wait(()=>!root.querySelector('[data-system-generate]').disabled);if(calls.native.length!==spoken.length)throw Error('重复生成未复用缓存');
 root.close();await new Promise(r=>setTimeout(r,200));await m.openSpeech({text,fullText:text,scope:'full',cardScope:scope});if(root.querySelector('[data-system-play]').disabled)throw Error('关闭重开丢失音频');root.querySelector('[data-system-audio]').volume=0;
 return {scope,recordId:saved.id,segments:spoken.length,realAnalysisReused:true,realNativeGeneration:true,bodyOnly:true,wavValid:true,cacheReuse:true,panelRestore:true,paidRequests:calls.paid};})()`);
 await c.call('Runtime.evaluate',{expression:"document.querySelector('[data-system-play]').click()",userGesture:true});
 await c.evaluate(`(async()=>{const t=window.__realPlayback;await t.wait(()=>t.root.querySelector('[data-system-status]').textContent.includes('连续播放完成'));})()`);
 const edited=await c.evaluate(`(async()=>{const t=window.__realPlayback,m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js'),before=t.calls.native.length,input=t.root.querySelector('[data-system-segment-pitch]');input.value='1.1';input.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,300));t.root.querySelector('[data-system-generate]').click();await t.wait(()=>!t.root.querySelector('[data-system-generate]').disabled);const saved=await m.loadSpeechSession(t.record.id,t.scope);return {partialRegeneration:t.calls.native.length===before+1,audioCount:saved.audio.length,paidRequests:t.calls.paid,nativeRequests:t.calls.native.length};})()`);
 assert.equal(edited.partialRegeneration,true);assert.equal(edited.paidRequests,0);
 const result={...setup,...edited,continuousPlayback:true,silentPlayback:true,limitation:'复用真实文本模型分析，系统实际生成和静音连续播放；未验证远程 TTS 接口音质。'};
 fs.writeFileSync('artifacts/tts-probe/real-analysis-system-playback.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
 await c.evaluate(`(async()=>{const t=window.__realPlayback;if(!t)return;t.root?.close();window.fetch=t.originalFetch;window.prompt=t.originalPrompt;for(const k of Object.keys(t.settings))delete t.settings[k];Object.assign(t.settings,t.previous);const {saveSettingsDebounced}=await import('/script.js');saveSettingsDebounced();await new Promise(r=>setTimeout(r,1500));delete window.__realPlayback;})()`).catch(()=>{});c.close();
}
