import {saveSettingsDebounced} from '/script.js';
import {showAnalysisFailureDiagnostic,mediaRequest,listSpeechSessions,loadSpeechSession,saveSpeechSession,analyzeSpeech,mountSpeechReviewTools,unresolvedSpeechSegments,chooseGenderVoice,voiceGenderLabel,classifyVoiceGender,classifyCharacterGender} from './media.js';

const pending=new Map();
window.__apkSystemTtsReply=({id,result,error})=>{const request=pending.get(id);if(!request)return;clearTimeout(request.timer);pending.delete(id);error?request.reject(Error(error)):request.resolve(result);};
export function nativeTts(action,body={}){
 if(!window.__apkSystemTtsAvailable)return Promise.reject(Error('此页面没有安卓语音转接，请在更新后的星栈 APK 中使用'));
 return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('安卓语音转接超时，请停止后重新检测'));},190000);pending.set(id,{resolve,reject,timer});try{const ack=prompt('__xingzhan_system_tts__:'+JSON.stringify({id,action,...body,token:window.__apkSystemTtsToken}), '');if(ack!=='accepted')throw Error('安卓语音转接拒绝了该页面请求');}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}});
}
export function splitSystemText(text,limit=3000){const parts=[];for(let start=0;start<text.length;){let end=Math.min(start+limit,text.length);if(end<text.length){const slice=text.slice(start,end);let boundary=0;for(const match of slice.matchAll(/[\n。！？.!?][”’"』」）)]*/g))if(match.index+match[0].length>=limit/2)boundary=match.index+match[0].length;if(boundary)end=start+boundary;if(/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;}parts.push(text.slice(start,end));start=end;}return parts;}
const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const esc=text=>String(text??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const spoken=record=>record.result.segments.filter(x=>['narration','dialogue'].includes(x.type));
export function emotionParameters(emotion,style,base,rawIntensity){
 const intensity = typeof rawIntensity === 'number' && Number.isFinite(rawIntensity) ? Math.max(0, Math.min(1, rawIntensity)) : 0.8;
 const description=(emotion||'')+' '+(style||'');let targetRate=1,targetPitch=1,targetPause=200;
 if(/悲|难过|低落|沮丧|伤心|sad/i.test(description)){targetRate=.88;targetPitch=.94;targetPause=450;}
 else if(/愤怒|生气|怒吼|恼怒|angry/i.test(description)){targetRate=1.12;targetPitch=.97;targetPause=120;}
 else if(/开心|快乐|兴奋|激动|欢快|happy|excited|intense/i.test(description)){targetRate=1.08;targetPitch=1.06;targetPause=150;}
 else if(/害怕|紧张|恐惧|fear|nervous|urgent/i.test(description)){targetRate=1.04;targetPitch=1.04;targetPause=300;}
 else if(/惊讶|震惊|shocked|surprised/i.test(description)){targetRate=.96;targetPitch=1.06;targetPause=350;}
 else if(/温柔|安慰|轻声|耳语|gentle|whisper/i.test(description)){targetRate=.93;targetPitch=.98;targetPause=300;}
 const factor = intensity / 0.8;
 const rate = 1.0 + (targetRate - 1.0) * factor;
 const pitch = 1.0 + (targetPitch - 1.0) * factor;
 const pauseMs = Math.round(200 + (targetPause - 200) * factor);
 const clamp=x=>Math.round(Math.max(.5,Math.min(2,x))*100)/100;
 return {rate:clamp(base.rate*rate),pitch:clamp(base.pitch*pitch),pauseMs:Math.max(0,pauseMs)};
}

export function classifyInstalledEngine(pkg, label = '') {
 if (pkg === 'com.k2fsa.sherpa.onnx.tts.engine' || /sherpa/i.test(pkg) || /sherpa/i.test(label)) return 'sherpa';
 if (/heytap|coloros|oppo|oplus|xiaomi|miui|huawei|honor|samsung|google.*tts|system/i.test(pkg) || /系统|小布|原厂|内置/i.test(label)) return 'builtin';
 return 'other_local';
}

export async function detectSystemEngines(targetEngine = '') {
 const result = await nativeTts('detect', { engine: targetEngine });
 const categorized = { sherpa: null, builtin: null, other_local: [], raw: result };
 for (const eng of result.engines || []) {
  const kind = classifyInstalledEngine(eng.package, eng.label);
  if (kind === 'sherpa' && !categorized.sherpa) categorized.sherpa = eng;
  else if (kind === 'builtin' && !categorized.builtin) categorized.builtin = eng;
  else categorized.other_local.push(eng);
 }
 return categorized;
}

export function mountSystemSpeech(workspace,settings,onReviewReady=()=>{}){
 const host=document.createElement('section');host.dataset.systemWorkspace='';host.hidden=true;
 host.innerHTML=`<p>安卓系统语音与 API 配音分别配置、分别保存。可直接朗读，也可沿用文本模型分析角色和情绪，再使用系统引擎分段配音。分析会调用文本 API；语音由系统生成。情绪仅通过语速、音高和停顿近似表现。</p><div class="xs-actions"><button class="menu_button" type="button" data-system-detect>检测系统语音引擎</button></div><p data-system-inventory role="status">尚未检测；检测不会朗读。</p><label>系统引擎<select class="text_pole" data-system-engine><option value="">请先检测</option></select></label><label>默认音色（分析后可为各角色单独选择）<select class="text_pole" data-system-voice><option value="">请先检测</option></select></label><label>语速<input class="text_pole" type="number" data-system-rate min="0.5" max="2" step="0.1" value="1"></label><label>音高<input class="text_pole" type="number" data-system-pitch min="0.5" max="2" step="0.1" value="1"></label><label>已保存的系统配音<select class="text_pole" data-system-history><option value="">暂无记录</option></select></label><button class="menu_button" type="button" data-system-restore>恢复系统配音</button><label class="checkbox_label"><input type="checkbox" data-system-context checked>结合附近最多 5 条消息分析</label><label class="checkbox_label"><input type="checkbox" data-system-remember checked>保存当前角色卡的系统音色记忆</label><div class="xs-actions"><button class="menu_button" type="button" data-system-analyze disabled>分析角色与情绪</button><button class="menu_button" type="button" data-system-cancel-analysis disabled>取消分析</button></div><p data-system-memory></p><section data-system-review hidden></section><div class="xs-actions"><button class="menu_button" type="button" data-system-generate disabled>确认生成系统语音</button><button class="menu_button" type="button" data-system-play disabled>分段连续播放</button><button class="menu_button" type="button" data-system-play-merged disabled>整篇播放</button><button class="menu_button" type="button" data-system-export disabled>导出合并音频</button><button class="menu_button" type="button" data-system-pause disabled>暂停</button><button class="menu_button" type="button" data-system-stop>停止</button></div><audio controls preload="metadata" data-system-audio></audio><p data-system-status role="status"></p>`;
 workspace.append(host);const query=selector=>workspace.querySelector('[data-system-'+selector+']'),audio=query('audio');
 const reviewPage=workspace.querySelector('[data-system-review-page]');reviewPage.append(query('review'));
 const controls=document.createElement('div');controls.dataset.systemPlayback='';controls.append(query('generate').parentElement,audio,query('status'));host.append(controls);
 let inventory=null,scope,record=null,queue=[],playIndex=0,epoch=0,busy=false,analysisController=null,source=null,memories=[],saveTail=Promise.resolve(),pauseTimer,activePreview=null;
 settings.systemTts??={engine:'',voice:'',rate:1,pitch:1};query('rate').value=settings.systemTts.rate;query('pitch').value=settings.systemTts.pitch;
 const config=()=>({engine:query('engine').value,voice:query('voice').value,rate:Number(query('rate').value),pitch:Number(query('pitch').value)});
 const saveConfig=()=>{settings.systemTts=config();saveSettingsDebounced();};
 function updateBase(voiceChanged=false){if(!record?.system.contextual)return;const cfg=config();record.system={...cfg,contextual:true};for(const segment of record.result.segments){if(segment.manualLocked)continue;const voice=voiceChanged&&segment.speakerId==='narrator'?cfg.voice:(inventory?.voices||[]).some(x=>x.installed&&x.name===segment.system.voice)?segment.system.voice:cfg.voice;segment.system={voice,...emotionParameters(segment.emotion,segment.style,cfg,segment.intensity)};}persistReview();renderReview();}
 function showMemory(){query('memory').textContent=`当前角色卡已保存 ${memories.filter(x=>x.engine===(inventory?.selectedEngine||settings.systemTts.engine)).length} 条系统音色记忆；与 API 音色分别保存。`;}
 async function remember(){
  const target=record,card={...scope},profiles=target.result.speakers||[],next=[...memories];
  for(const segment of spoken(target)){if(segment.speakerId==='__unresolved__')continue;const profile=profiles.find(x=>x.id===segment.speakerId)||{id:segment.speakerId,name:segment.speakerId==='narrator'?'旁白':segment.speakerId},item={characterId:profile.id,displayName:profile.name,aliases:profile.aliases||[],summary:profile.summary||'',engine:target.system.engine,voice:segment.system.voice,voiceSource:segment.voiceSource||'auto',gender:profile.gender||'unknown'};const index=next.findIndex(x=>x.characterId===item.characterId&&x.engine===item.engine);if(index>=0)next[index]=item;else next.push(item);}
  const saved=await (await mediaRequest('system-memory',{characters:next,scopeId:card.id,scopeLabel:card.label})).json();if(record===target&&scope.id===card.id){memories=saved.characters;showMemory();}
 }
 function persistReview(){
  clear();const target=record,card={...scope},snapshot=JSON.parse(JSON.stringify(target));
  saveTail=saveTail.catch(()=>{}).then(async()=>{if(snapshot.system.contextual)for(const segment of snapshot.result.segments)snapshot.voices[segment.speakerId]=await hash(snapshot.system.engine+"\n"+segment.system.voice);return saveSpeechSession(snapshot,card);}).then(async saved=>{if(record===target){record.audio=saved.audio;record.voices=saved.voices;record.updatedAt=saved.updatedAt;record.reviewRevision=saved.reviewRevision;if(query('remember').checked&&snapshot.result.segments.some(x=>x.voiceSource==='manual'))await remember();query('status').textContent='角色音色和逐段参数已保存。';}return saved;});
  void saveTail.catch(error=>{if(record===target)query('status').textContent='保存失败：'+error.message;});return saveTail;
 }
 function renderReview(){
  const review=query('review');review.replaceChildren();review.hidden=!record?.system?.contextual;host.append(controls);if(review.hidden)return;
  const reviewTools=mountSpeechReviewTools(review,record.result,persistReview,()=>busy,{scope,onRebuild:renderReview,defaultSystem:record.system,getLocalRecord:async()=>{await saveTail;return record;},onReanalyze:reanalyzeSelected,onCancelReanalyze:()=>analysisController?.abort()});
  const available=(inventory?.voices||[]).filter(x=>x.installed),profiles=new Map((record.result.speakers||[]).filter(p=>!p.mergedInto).map(x=>[x.id,x]));
  profiles.set('narrator',profiles.get('narrator')||{id:'narrator',name:'旁白'});
  for(const segment of record.result.segments)if(!profiles.has(segment.speakerId))profiles.set(segment.speakerId,{id:segment.speakerId,name:segment.speakerId==='narrator'?'旁白':segment.speakerId});
  const title=document.createElement('p');title.textContent=`分析模型：${record.result.model}；${spoken(record).length} 段将使用系统语音生成。音效、背景音乐和环境音描述跳过。`+(record.result.segments.some(x=>Array.isArray(x.unitIds)&&x.unitIds.length>1)?' 此记录来自旧版合并分析，请点击“分析角色与情绪”重新识别剧情人物。':'');review.append(title);
  for(const profile of profiles.values()){
   const segments=record.result.segments.filter(x=>x.speakerId===profile.id),voice=segments.find(x=>x.system)?.system.voice||record.system.voice;
   const charGender=classifyCharacterGender(profile);
   const initialCategory=charGender==='male'?'male':charGender==='female'||charGender==='neutral'?'female':'all';
   const row=document.createElement('div');row.className='xs-profile';row.dataset.profileId=profile.id;
   row.innerHTML=`<b>${esc(profile.name||profile.id)} · 系统音色${profile.voiceGenderWarning?' · '+esc(profile.voiceGenderWarning):''}</b><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label style="flex:0 0 110px">性别大类<select class="text_pole" data-system-gender-filter="${esc(profile.id)}"><option value="female" ${initialCategory==='female'?'selected':''}>女声池</option><option value="male" ${initialCategory==='male'?'selected':''}>男声池</option><option value="all" ${initialCategory==='all'?'selected':''}>全部音色</option></select></label><label style="flex:1 1 180px">选择音色<select class="text_pole" data-system-role="${esc(profile.id)}"></select></label><button type="button" class="menu_button" data-system-preview="${esc(profile.id)}" style="flex:0 0 auto;margin-top:auto" title="试听该音色">▶ 试听</button></div><small>根据人物特征自动定位大类；切换大类后音色池联动过滤。</small>`;
   const filterSelect=row.querySelector('[data-system-gender-filter]'),voiceSelect=row.querySelector('[data-system-role]');
   function updateVoiceOptions(selectedCategory,currentVoice){
    const allNames=[...new Set([currentVoice,...available.map(x=>x.name)])];
    const filtered=allNames.filter(name=>{
     if(selectedCategory==='all'||name===currentVoice)return true;
     const g=classifyVoiceGender(name);
     return selectedCategory==='female'?(g==='female'||g==='unknown'):selectedCategory==='male'?(g==='male'||g==='unknown'):true;
    });
    voiceSelect.replaceChildren();
    for(const name of filtered){
     const opt=document.createElement('option');
     opt.value=name;
     opt.textContent=`${name} · ${voiceGenderLabel(name)}`;
     if(available.length&&!available.some(x=>x.name===name))opt.disabled=true;
     if(name===currentVoice)opt.selected=true;
     voiceSelect.append(opt);
    }
    if(!filtered.includes(voiceSelect.value)&&filtered.length){
     voiceSelect.value=filtered[0];
    }
   }
   updateVoiceOptions(filterSelect.value,voice);
   voiceSelect.disabled=busy;filterSelect.disabled=busy;
   filterSelect.onchange=()=>{
    updateVoiceOptions(filterSelect.value,voiceSelect.value);
    for(const segment of segments.filter(x=>!x.manualLocked))segment.system={...segment.system,voice:voiceSelect.value},segment.voiceSource='manual';
    persistReview();
   };
   voiceSelect.onchange=()=>{
    for(const segment of segments.filter(x=>!x.manualLocked))segment.system={...segment.system,voice:voiceSelect.value},segment.voiceSource='manual';
    persistReview();
   };
   const previewBtn = row.querySelector("[data-system-preview]");
   previewBtn.onclick = async () => {
     if (activePreview?.btn === previewBtn) {
       activePreview.audio.pause();
       previewBtn.textContent = "▶ 试听";
       activePreview = null;
       return;
     }
     if (activePreview) {
       activePreview.audio.pause();
       activePreview.btn.textContent = "▶ 试听";
       activePreview = null;
     }
     const targetVoice = voiceSelect.value;
     if (!targetVoice) return;
     previewBtn.disabled = true; previewBtn.textContent = "⏳ 生成中…";
     try {
       const cfg = config();
       const targetEngine = record?.system?.engine || inventory?.selectedEngine || cfg.engine || settings.systemTts?.engine || '';
       if (targetEngine && inventory?.selectedEngine !== targetEngine) {
         await detect(targetEngine);
       }
       const sample = "你好，我是" + (profile.name || "发音人") + "，这是我的试听声音。";
       const res = await nativeTts("synthesize", { engine: targetEngine, voice: targetVoice, rate: cfg.rate || 1, pitch: cfg.pitch || 1, text: sample, scopeId: scope?.id || 'preview' });
       const previewAudio = new Audio();
       previewAudio.src = "/api/android/media/system-preview/" + res.key;
       previewBtn.textContent = "⏹ 停止"; previewBtn.disabled = false;
       activePreview = { audio: previewAudio, btn: previewBtn };
       previewAudio.onended = () => { if (activePreview?.btn === previewBtn) { previewBtn.textContent = "▶ 试听"; activePreview = null; } };
       previewAudio.onerror = () => { if (activePreview?.btn === previewBtn) { previewBtn.textContent = "▶ 试听"; activePreview = null; } query("status").textContent = "试听音频加载失败"; };
       await previewAudio.play();
     } catch (err) {
       previewBtn.textContent = "▶ 试听"; previewBtn.disabled = false;
       if (activePreview?.btn === previewBtn) activePreview = null;
       query("status").textContent = "试听失败：" + err.message;
     }
   };
   review.append(row);
  }
  for(const [index,segment] of record.result.segments.entries()){
   const row=document.createElement('div');row.className='xs-segment';row.innerHTML=`<b>${index+1}. ${esc(segment.text)}</b><label>类型<select class="text_pole" data-system-type>${[['narration','旁白'],['dialogue','角色台词'],['sfx','音效（跳过）'],['bgm','音乐（跳过）'],['ambience','环境音（跳过）']].map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label>角色<select class="text_pole" data-system-speaker>${[...profiles.values()].map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join('')}</select></label><label>情绪<input class="text_pole" data-system-emotion maxlength="60" value="${esc(segment.emotion||'平静')}"></label><label>强度<input class="text_pole" type="number" data-system-intensity min="0" max="1" step="0.05" value="${segment.intensity??0.8}"></label><label>语气<input class="text_pole" data-system-style maxlength="200" value="${esc(segment.style||'自然')}"></label>${[['rate','语速',.5,2,.01],['pitch','音高',.5,2,.01],['pauseMs','段后停顿（毫秒）',0,3000,50]].map(([name,label,min,max,step])=>`<label>${label}<input class="text_pole" type="number" data-system-segment-${name} min="${min}" max="${max}" step="${step}" value="${segment.system?.[name]??(name==='pauseMs'?200:1)}"></label>`).join('')}`;
   const type=row.querySelector('[data-system-type]'),speaker=row.querySelector('[data-system-speaker]');type.value=segment.type;speaker.value=segment.speakerId;
   type.onchange=()=>{segment.type=type.value;if(type.value==='narration'){segment.speakerId='narrator';speaker.value='narrator';segment.system.voice=review.querySelector('[data-system-role="narrator"]').value;}persistReview();};speaker.onchange=()=>{segment.speakerId=speaker.value;segment.system.voice=review.querySelector('[data-system-role="'+CSS.escape(speaker.value)+'"]').value;persistReview();};
   for(const field of ['emotion','style','intensity'])row.querySelector('[data-system-'+field+']').onchange=event=>{segment[field]=field==='intensity'?Math.max(0,Math.min(1,Number(event.target.value)||0)):event.target.value;Object.assign(segment.system,emotionParameters(segment.emotion,segment.style,record.system,segment.intensity));for(const name of ['rate','pitch','pauseMs'])row.querySelector('[data-system-segment-'+name+']').value=segment.system[name];persistReview();};
   for(const field of ['rate','pitch','pauseMs'])row.querySelector('[data-system-segment-'+field+']').onchange=event=>{const value=Number(event.target.value),min=field==='pauseMs'?0:.5,max=field==='pauseMs'?3000:2;if(!Number.isFinite(value)||value<min||value>max){event.target.value=segment.system[field];return;}segment.system[field]=value;persistReview();};
   for(const input of row.querySelectorAll('input,select'))input.disabled=busy;reviewTools.decorate(row,segment,index);review.append(row);
  }
  reviewTools.refresh();
 }
 async function reanalyzeSelected(indices,range){
  if(busy)throw Error('请先停止当前任务');const ticket=epoch,card={...scope},controller=new AbortController();analysisController=controller;busy=true;
  try{await saveTail;if(ticket!==epoch||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');const saved=await (await mediaRequest('reanalyze',{sessionId:record.id,indices,range,expectedRevision:record.reviewRevision,scopeId:card.id,analysisRequestId:crypto.randomUUID(),analysisDiagnostics:workspace.querySelector('[data-analysis-diagnostics]')?.checked===true},controller.signal)).json();if(ticket!==epoch)return;
   const known=new Set((record.result.speakers||[]).map(x=>x.id)),available=(inventory?.voices||[]).filter(x=>x.installed),local=available.filter(x=>/^zh|^chn$/i.test(x.language)||x.name.includes('中文')),choices=local.length?local:available,assigned=new Map();for(const index of saved.localAnalysisIndices||indices){const segment=saved.result.segments[index];if(!known.has(segment.speakerId)&&segment.speakerId!=='narrator'&&choices.length){if(!assigned.has(segment.speakerId)){const p=saved.result.speakers.find(x=>x.id===segment.speakerId)||{},selection=chooseGenderVoice(p,choices,{preferred:saved.system.voice,used:saved.result.segments.filter(x=>known.has(x.speakerId)).map(x=>x.system?.voice)});assigned.set(segment.speakerId,selection.voice);p.voiceGenderWarning=selection.warning;}segment.system.voice=assigned.get(segment.speakerId);segment.voiceSource='auto';}}record=saved;await persistReview();if(ticket!==epoch)return;busy=false;analysisController=null;renderReview();query('status').textContent=saved.result.reviewNotice;
  }catch(error){if(ticket===epoch&&!controller.signal.aborted)await showAnalysisFailureDiagnostic(workspace,error,card,()=>ticket===epoch);throw Error(controller.signal.aborted?'局部分析已取消，原记录保留':error.message);}finally{if(ticket===epoch){busy=false;analysisController=null;}}
 }
 async function analyze(){
  if(busy)return;const text=workspace.querySelector('[data-speech-text]').value;if(!text.trim()||text.length>120000){query('status').textContent='正文为空或超过 120000 字';return;}if(!inventory?.ready||!config().voice){query('status').textContent='请先检测系统音色';return;}
  stop();const ticket=epoch,card={...scope},cfg=config(),controller=new AbortController();analysisController=controller;busy=true;renderReview();query('analyze').disabled=true;query('generate').disabled=true;query('detect').disabled=true;query('cancel-analysis').disabled=false;for(const field of ['engine','voice','rate','pitch'])query(field).disabled=true;
  query('status').textContent='正在调用文本模型分析角色和情绪；长文本会自动分批…';const requestId=crypto.randomUUID();let polling=false;
  const timer=setInterval(async()=>{if(polling||ticket!==epoch)return;polling=true;try{const data=await (await mediaRequest('analysis-progress/'+requestId+'?scope='+encodeURIComponent(card.id))).json();if(ticket===epoch&&data.state==='running'&&data.total)query('status').textContent=`分析已保存 ${data.completed}/${data.total} 批…`;}catch{}finally{polling=false;}},1500);
  try{
   await saveTail;const result=await analyzeSpeech(text,query('context').checked?source?.context||[]:[],controller.signal,{scopeId:card.id,scopeLabel:card.label,source,analysisRequestId:requestId,analysisProvider:'system',analysisDiagnostics:workspace.querySelector('[data-analysis-diagnostics]')?.checked===true});if(ticket!==epoch)return;
   const analyzed=await loadSpeechSession(result.sessionId,card);if(ticket!==epoch)return;
   const available=inventory.voices.filter(x=>x.installed),local=available.filter(x=>/^zh|^chn$/i.test(x.language)||x.name.includes('中文')),choices=local.length?local:available,voiceMap=new Map(),voices={};
   const profiles=new Map((analyzed.result.speakers||[]).map(x=>[x.id,x]));profiles.set('narrator',profiles.get('narrator')||{id:'narrator',name:'旁白'});
   const segments=[];for(const segment of analyzed.result.segments){
    const profile=profiles.get(segment.speakerId)||{id:segment.speakerId,name:segment.speakerId},identity=[profile.name,...profile.aliases||[]];
    if(!voiceMap.has(segment.speakerId)){const matches=memories.filter(x=>x.engine===cfg.engine&&(x.characterId===segment.speakerId||!profile.identityConflict&&[x.displayName,...x.aliases||[]].some(name=>identity.includes(name)))&&available.some(v=>v.name===x.voice)),remembered=matches.find(x=>x.characterId===segment.speakerId)||(matches.length===1?matches[0]:null);const selection=chooseGenderVoice(profile,choices,{remembered,preferred:cfg.voice,used:[...voiceMap.values()],narrator:segment.speakerId==='narrator'}),voice=selection.voice;profile.voiceGenderWarning=selection.warning;profile.voiceSource=selection.source;voiceMap.set(segment.speakerId,voice);voices[segment.speakerId]=await hash(cfg.engine+'\n'+voice);}
    for(const part of splitSystemText(segment.text,Math.min(3000,inventory.maxTextLength||3000)))segments.push({...segment,voiceSource:profile.voiceSource||'auto',text:part,system:{voice:voiceMap.get(segment.speakerId),...emotionParameters(segment.emotion,segment.style,cfg,segment.intensity)}});
   }
   if(ticket!==epoch)return;const saved=await saveSpeechSession({provider:'system',system:{...cfg,contextual:true},text,source,result:{...analyzed.result,segments},voices},card);if(ticket!==epoch)return;record=saved;if(query('remember').checked)await remember();if(ticket!==epoch)return;apply();await history();query('status').textContent='分析与角色音色已保存；审核逐段参数后确认生成。';renderReview();onReviewReady();
  }catch(error){if(ticket===epoch){query('status').textContent=controller.signal.aborted?'已取消分析，已有记录保留':'分析失败：'+error.message;if(!controller.signal.aborted)await showAnalysisFailureDiagnostic(workspace,error,card,()=>ticket===epoch);}}
  finally{clearInterval(timer);if(ticket===epoch){busy=false;analysisController=null;for(const field of ['analyze','generate','detect','engine','voice','rate','pitch'])query(field).disabled=false;query('cancel-analysis').disabled=true;renderReview();}}
 }
 function clear(){if(activePreview){activePreview.audio.pause();activePreview.btn.textContent='▶ 试听';activePreview=null;}clearTimeout(pauseTimer);audio.pause();audio.removeAttribute('src');audio.load();queue=[];playIndex=0;query('play').disabled=true;query('pause').disabled=true;query('play-merged').disabled=!record?.audio?.length;query('export').disabled=!record?.audio?.length;}
 function stop(){epoch++;analysisController?.abort();analysisController=null;busy=false;query("cancel-analysis").disabled=true;query("analyze").disabled=!inventory?.ready;clear();query('generate').disabled=!inventory?.ready||!query('voice').value;query('detect').disabled=false;for(const field of ['engine','voice','rate','pitch'])query(field).disabled=false;void nativeTts('stop').catch(()=>{});}
 function apply(){clear();if(!record)return;const segments=spoken(record);for(let index=0;index<segments.length;index++){const clip=record.audio.find(x=>x.index===index);if(!clip)break;queue.push({url:clip.url,pauseMs:segments[index].system?.pauseMs||0});}query('play').disabled=!queue.length;query('pause').disabled=!queue.length;query('play-merged').disabled=!record.audio?.length;query('export').disabled=!record.audio?.length;if(queue.length){audio.src=queue[0].url;audio.load();}query('status').textContent=`已恢复 ${record.audio.length}/${segments.length} 段系统音频，已完成片段可复用。`;}
 async function history(){const ticket=epoch,data=await listSpeechSessions(scope);if(ticket!==epoch)return [];const records=data.sessions.filter(x=>x.provider==='system');query('history').innerHTML='<option value="">选择系统配音记录</option>'+records.map(x=>`<option value="${x.id}">${esc(x.text.slice(0,25))} · ${x.audioCount}/${x.total} 段</option>`).join('');return records;}
 async function restore(id,ticket=epoch){if(!id)return;const saved=await loadSpeechSession(id,scope);if(ticket!==epoch)return;if(saved.provider!=='system')throw Error('该记录不是系统配音');record=saved;source=saved.source||source;workspace.querySelector('[data-speech-text]').value=saved.text;settings.systemTts={...saved.system};query('rate').value=saved.system.rate;query('pitch').value=saved.system.pitch;if(saved.system?.engine&&(!inventory||inventory.selectedEngine!==saved.system.engine)){try{await detect(saved.system.engine);}catch{}if(ticket!==epoch)return;}if([...query('engine').options].some(x=>x.value===saved.system.engine))query('engine').value=saved.system.engine;if([...query('voice').options].some(x=>x.value===saved.system.voice))query('voice').value=saved.system.voice;apply();query('history').value=id;renderReview();if(saved.system?.contextual)onReviewReady();}
 async function open(cardScope,text,exact=false,data=null){stop();const ticket=epoch;scope={...cardScope};source=data;record=null;renderReview();if(!inventory)void detect(settings.systemTts?.engine||'').catch(()=>{});try{await saveTail.catch(()=>{});const memory=await (await mediaRequest("system-memory?scope="+encodeURIComponent(scope.id))).json();if(ticket!==epoch)return;memories=memory.characters;showMemory();const records=await history();if(ticket!==epoch)return;if(!exact&&records[0])return restore(records[0].id,ticket);for(const item of records.filter(x=>x.text===text.slice(0,80))){const saved=await loadSpeechSession(item.id,scope);if(ticket!==epoch)return;if(saved.text===text){await restore(item.id,ticket);return;}}query('status').textContent='选择或粘贴正文，检测并选好音色后确认生成。';}catch(error){if(ticket===epoch)query('status').textContent=error.message;}}
 async function detect(engine=''){
  if(busy)return;inventory=null;query('generate').disabled=true;query('analyze').disabled=true;query('detect').disabled=true;query('engine').disabled=true;query('voice').disabled=true;query('inventory').textContent='正在检测引擎并读取音色，不播放语音…';const ticket=epoch;
  try{const result=await nativeTts('detect',{engine});if(ticket!==epoch)return;inventory=result;query('engine').innerHTML=(result.engines||[]).map(x=>`<option value="${esc(x.package)}">${esc(x.label||x.package)}</option>`).join('');query('engine').value=result.selectedEngine||'';const voices=result.voices||[];query('voice').innerHTML=voices.map(x=>`<option value="${esc(x.name)}" ${x.installed?'':'disabled'}>${esc(x.name)} · ${esc(voiceGenderLabel(x))} · ${esc(x.language)}${x.networkRequired?' · 联网':' · 本地'}${x.installed?'':' · 未下载'}</option>`).join('');query('voice').value=voices.some(x=>x.name===settings.systemTts.voice&&x.installed)?settings.systemTts.voice:result.defaultVoice||voices.find(x=>x.installed)?.name||'';
   const preferred=voices.find(x=>x.name===settings.systemTts.voice&&x.installed)||voices.find(x=>x.name===result.defaultVoice&&x.installed)||voices.find(x=>x.installed);query('voice').value=preferred?.name||'';
   query('inventory').textContent=`检测到 ${result.engines?.length||0} 个引擎，所选引擎提供 ${voices.length} 个音色（中文 ${voices.filter(x=>/^zh|^chn$/i.test(x.language)||x.name.includes('中文')).length} 个）。`+(result.error||'');query('generate').disabled=!result.ready||!query('voice').value;saveConfig();query('analyze').disabled=!result.ready||!query('voice').value;if(record?.system.contextual&&record.system.engine!==result.selectedEngine&&query('voice').value)updateBase();showMemory();renderReview();return result;
  }catch(error){if(ticket!==epoch)return;query('inventory').textContent='检测失败：'+error.message;query('generate').disabled=true;throw error;}finally{if(ticket===epoch){query('detect').disabled=false;query('engine').disabled=false;query('voice').disabled=false;}}
 }
 async function generate(){
  if(busy)return;if(record?.system.contextual&&unresolvedSpeechSegments(record.result).length){query('status').textContent='请先审核待确认的发言人，或明确确认按旁白音色朗读。';onReviewReady();return;}const text=workspace.querySelector('[data-speech-text]').value,cfg=config();if(!text.trim()||text.length>120000){query('status').textContent='正文为空或超过 120000 字';return;}if(!inventory?.ready||!cfg.voice){query('status').textContent='请先手动检测引擎并选择可用音色';return;}
  if(record?.system.contextual&&record.system.engine!==inventory.selectedEngine){query('status').textContent='请先检测记录所用的系统引擎，再确认生成。';return;}
  if(record?.system.contextual&&spoken(record).some(x=>!inventory.voices.some(v=>v.installed&&v.name===x.system.voice))){query('status').textContent='记录中的音色当前不可用，请为角色重新选择已安装音色。';return;}
  const ticket=++epoch;busy=true;clear();renderReview();for(const field of ['generate','analyze','detect','engine','voice','rate','pitch','play-merged','export'])query(field).disabled=true;
  try{await saveTail;if(ticket!==epoch)return;const style=`系统语速 ${cfg.rate}；音高 ${cfg.pitch}`,voiceId=await hash(cfg.engine+'\n'+cfg.voice);
   if(!record||record.text!==text||(!record.system.contextual&&JSON.stringify(record.system)!==JSON.stringify(cfg))){const segments=splitSystemText(text,Math.min(3000,inventory.maxTextLength||3000)).map(part=>({text:part,type:part.trim()?'narration':'ambience',speakerId:'narrator',emotion:'',style}));const saved=await saveSpeechSession({text,provider:'system',system:cfg,result:{model:'安卓系统语音',segments,speakers:[]},voices:{narrator:voiceId}},scope);if(ticket!==epoch)return;record=saved;}
   const segments=spoken(record);for(let index=0;index<segments.length;index++){if(ticket!==epoch)return;if(record.audio.some(x=>x.index===index))continue;query('status').textContent=`正在生成并保存系统语音 ${index+1}/${segments.length} 段…`;const parameters={...(record.system.contextual?record.system:cfg),...segments[index].system};const textToSend=segments[index].text;const generated=await nativeTts('synthesize',{engine:parameters.engine,voice:parameters.voice,rate:parameters.rate,pitch:parameters.pitch,text:textToSend,scopeId:scope.id});if(ticket!==epoch)return;const saved=await (await mediaRequest('system-clip',{key:generated.key,sessionId:record.id,segmentIndex:index,scopeId:scope.id})).json();if(ticket!==epoch)return;record=saved;}
   if(ticket!==epoch)return;if(record.system.contextual&&query('remember').checked)await remember();if(ticket!==epoch)return;apply();query('status').textContent='系统语音已保存，点击连续播放；重播不重新生成。';await history();
  }catch(error){if(ticket===epoch){apply();query('status').textContent='系统生成失败：'+error.message+'；已完成音频保留。';}}
  finally{if(ticket===epoch){busy=false;for(const field of ['generate','analyze','detect','engine','voice','rate','pitch'])query(field).disabled=false;query('play-merged').disabled=!record?.audio?.length;query('export').disabled=!record?.audio?.length;renderReview();}}
 }
 async function playMerged(){
  clearTimeout(pauseTimer);if(!record?.id||!record?.audio?.length)return;
  const fullUrl='/api/android/media/session/'+record.id+'/full-audio?scope='+encodeURIComponent(scope.id)+'&t='+Date.now();
  if(audio.src!==fullUrl){audio.src=fullUrl;audio.load();}
  try{
   await audio.play();
   query('status').textContent='正在播放整篇合并音频（可直接拖动下方进度条快进/快退）。';
   query('pause').disabled=false;
  }catch(error){query('status').textContent='请点击播放器播放：'+error.message;}
 }
 function exportMerged(){
  if(!record?.id||!record?.audio?.length)return;
  const exportUrl='/api/android/media/session/'+record.id+'/full-audio?download=1&scope='+encodeURIComponent(scope.id);
  const a=document.createElement('a');a.href=exportUrl;
  a.download=(scope.label||'语音')+'_'+record.id.slice(0,8)+'.wav';
  document.body.append(a);a.click();a.remove();
  query('status').textContent=`已触发整篇音频导出（共 ${record.audio.length} 个片段无损拼接，包含情绪自然停顿）。`;
 }
 async function play(resume=false){clearTimeout(pauseTimer);if(!queue.length)return;if(!resume){audio.src=queue[playIndex].url;audio.load();}try{await audio.play();query('status').textContent=`正在播放系统语音 ${playIndex+1}/${queue.length} 段`;}catch(error){query('status').textContent='请点击播放器播放：'+error.message;}}
 query('detect').onclick=()=>void detect(query('engine').value).catch(()=>{});query('engine').onchange=()=>void detect(query('engine').value).catch(()=>{});
 for(const field of ['voice','rate','pitch'])query(field).onchange=()=>{saveConfig();updateBase(field==='voice');query('status').textContent='基础参数已保存；角色模式中的语速和音高已按情绪重新计算。角色音色可在审核区修改。';};
 query('analyze').onclick=()=>void analyze();query('cancel-analysis').onclick=()=>analysisController?.abort();
 query('restore').onclick=()=>{stop();void restore(query('history').value).catch(error=>{query('status').textContent=error.message;});};query('generate').onclick=()=>void generate();query('play').onclick=()=>void play(audio.paused&&audio.currentTime>0);query('play-merged').onclick=()=>void playMerged();query('export').onclick=()=>exportMerged();query('pause').onclick=()=>{clearTimeout(pauseTimer);audio.pause();query('status').textContent='已暂停，连续播放可继续。';};query('stop').onclick=()=>{const saved=record;stop();record=saved;apply();renderReview();query('status').textContent='已停止，已保存的音频保留。';};
 audio.onended=()=>{if(playIndex+1<queue.length){const delay=queue[playIndex].pauseMs;playIndex++;audio.src=queue[playIndex].url;audio.load();const ticket=epoch;pauseTimer=setTimeout(()=>{if(ticket===epoch)void play();},delay);}else{playIndex=0;audio.src=queue[0].url;audio.load();query('status').textContent='系统语音连续播放完成。';}};
 audio.onerror=()=>{query('status').textContent='已保存的系统音频无法播放，请检查引擎返回的格式。';};
 return {host,open,stop,detect,invalidate(){stop();record=null;renderReview();},get record(){return record;}};
}
