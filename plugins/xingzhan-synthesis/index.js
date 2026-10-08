import {extension_settings} from '/scripts/extensions.js';
import {saveSettingsDebounced,isGenerating,saveSettings} from '/script.js';
import {saveBase64AsFile} from '/scripts/utils.js';
import {showAnalysisFailureDiagnostic,form,mount,initSelectionTts,messageSpeechData,currentCardImageSource,mediaRequest,relayImage,tokenizeNpuImagePrompt,getImageQueueStatus,cancelImageTask,generateImagePrompt,loadImageHistory,deleteImageHistory,analyzeSpeech,loadVoiceMemory,saveVoiceMemory,currentSpeechScope,listSpeechSessions,loadSpeechSession,loadSpeechWorldReferences,worldReferenceStatus,mountSpeechReviewTools,speechReviewReasons,unresolvedSpeechSegments,voiceGenderLabel,classifyVoiceGender,classifyCharacterGender} from './media.js';
import {mountSystemSpeech,nativeTts,detectSystemEngines,classifyInstalledEngine,emotionParameters} from './system.js';
import {mountMascot} from './mascot.js';

let settings,speech,workspace,dialog,imageDialog,analysisController,generationController,imageController,imageEpoch=0,epoch=0,source=null,imagePromptController=null,lastImageSource=null,imageHistory=[];
let playQueue=[],playIndex=0,voiceMemory={schemaVersion:1,characters:[]};
let activeScope,activeSession=null,draftTimer,draftTail=Promise.resolve();
let systemSpeech,pauseTimer=null,activePreview=null;

const VOICES=['Kore','Puck','Aoede','Leda','Zephyr'];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Multi-Engine Collaboration State
const ENGINE_DEFS = {
 gemini: { id: 'gemini', name: '星栈中转 (Gemini 3.8)', badge: '云端高表现力', color: '#1565c0', desc: '细腻戏感情绪，剧本级演绎，适合主角对白与高戏剧性片段' },
 sherpa: { id: 'sherpa', name: '本地 Sherpa (Kokoro-82M)', badge: '24kHz 离线', color: '#2e7d32', desc: '103 款音色，0 Token 消耗，极速自然，适合旁白/正文与高频台词' },
 builtin: { id: 'builtin', name: '安卓内置系统引擎', badge: '极轻量零内存', color: '#ef6c00', desc: '系统原厂发音，秒开低耗，适合环境音与杂役龙套' },
 sillytavern: { id: 'sillytavern', name: '酒馆自带引擎', badge: '扩展兼容', color: '#6a1b9a', desc: 'Edge-TTS / XTTS / Bark，酒馆扩展发音人' },
 other_local: { id: 'other_local', name: '其他本地引擎', badge: '系统服务', color: '#455a64', desc: 'TTS-Server、外部离线语音服务' }
};

const ENGINE_PRESETS = {
 golden: {
  name: '🌟 黄金混合 (推荐)',
  desc: 'Sherpa 负责旁白与长文叙事（0 Token 消耗，极速自然）；Gemini 负责主角对白（剧本级细腻戏感）；内置引擎负责杂役龙套。',
  pool: { sherpa: true, gemini: true, builtin: true, sillytavern: false, other_local: false },
  narratorEngine: 'sherpa',
  dialogueEngine: 'gemini'
 },
 offline: {
  name: '⚡ 100% 纯本地离线',
  desc: '零 Token 成本：全部使用设备端引擎，断网可用，高隐私，毫秒级响应。',
  pool: { sherpa: true, gemini: false, builtin: true, sillytavern: false, other_local: false },
  narratorEngine: 'sherpa',
  dialogueEngine: 'sherpa'
 },
 cloud: {
  name: '☁️ 全云端电影级',
  desc: '全篇由星栈 Gemini 3.8 Flash Lite 剧本级演出，极强情绪感染力与音效把控。',
  pool: { gemini: true, sherpa: false, builtin: false, sillytavern: false, other_local: false },
  narratorEngine: 'gemini',
  dialogueEngine: 'gemini'
 },
 custom: {
  name: '🛠️ 自定义分工',
  desc: '自由勾选任意引擎，在审核面板中为每个角色独立指派引擎与发音人。',
  pool: null
 }
};

let installedEngines = { sherpa: null, builtin: null, other_local: [], raw: null };
let engineVoices = {
 gemini: VOICES.map(v => ({ name: v, label: `${v} · ${voiceGenderLabel(v)}`, gender: classifyVoiceGender(v), installed: true })),
 sherpa: [],
 builtin: [],
 other_local: []
};

function getEngineLabel(engineId) {
 return ENGINE_DEFS[engineId]?.name || engineId;
}

function getEnginePackage(engineId) {
 if (engineId === 'sherpa') return installedEngines.sherpa?.package || 'com.k2fsa.sherpa.onnx.tts.engine';
 if (engineId === 'builtin') return installedEngines.builtin?.package || '';
 if (engineId === 'other_local') return installedEngines.other_local[0]?.package || '';
 return '';
}

export async function detectAllEngines() {
 const statusEl = workspace?.querySelector('[data-engine-pool-status]');
 const refreshButton=workspace?.querySelector('[data-detect-all-engines]');
 const reportPanel=workspace?.querySelector('[data-local-model-report]');
 const reportEl=workspace?.querySelector('[data-local-model-report-content]');
 const reports=[];
 if (statusEl) statusEl.textContent = '正在检测已安装引擎及音色…';
 if(refreshButton){refreshButton.disabled=true;refreshButton.textContent='正在扫描…';}
 try {
  if (typeof window !== 'undefined' && window.__apkSystemTtsAvailable) {
   const categorized = await detectSystemEngines();
   installedEngines = categorized;
   if (categorized.sherpa) {
    try {
     const sherpaRes = await nativeTts('detect', { engine: categorized.sherpa.package });
     reports.push({label:categorized.sherpa.label||'Sherpa 本地引擎',package:categorized.sherpa.package,result:sherpaRes});
     engineVoices.sherpa = (sherpaRes.voices || []).map(v => ({
      name: v.name,
      label: `${v.name} · ${voiceGenderLabel(v)} · ${v.language || 'zh'}`,
      gender: classifyVoiceGender(v),
      installed: v.installed,
      language:v.language,
      networkRequired:v.networkRequired,
      quality:v.quality,
      latency:v.latency,
      features:v.features||[]
     }));
    } catch (e) {
     console.warn('Detect sherpa voices failed', e);
     reports.push({label:categorized.sherpa.label||'Sherpa 本地引擎',package:categorized.sherpa.package,error:e.message});
    }
   }
   if (categorized.builtin) {
    try {
     const builtinRes = await nativeTts('detect', { engine: categorized.builtin.package });
     reports.push({label:categorized.builtin.label||'系统内置引擎',package:categorized.builtin.package,result:builtinRes});
     engineVoices.builtin = (builtinRes.voices || []).map(v => ({
      name: v.name,
      label: `${v.name} · ${voiceGenderLabel(v)} · ${v.language || 'zh'}`,
      gender: classifyVoiceGender(v),
      installed: v.installed,
      language:v.language,
      networkRequired:v.networkRequired,
      quality:v.quality,
      latency:v.latency,
      features:v.features||[]
     }));
    } catch (e) {
     console.warn('Detect builtin voices failed', e);
     reports.push({label:categorized.builtin.label||'系统内置引擎',package:categorized.builtin.package,error:e.message});
    }
   }
   if (categorized.other_local?.length) {
    try {
     const otherRes = await nativeTts('detect', { engine: categorized.other_local[0].package });
     reports.push({label:categorized.other_local[0].label||'其他本地引擎',package:categorized.other_local[0].package,result:otherRes});
     engineVoices.other_local = (otherRes.voices || []).map(v => ({
      name: v.name,
      label: `${v.name} · ${voiceGenderLabel(v)} · ${v.language || 'zh'}`,
      gender: classifyVoiceGender(v),
      installed: v.installed,
      language:v.language,
      networkRequired:v.networkRequired,
      quality:v.quality,
      latency:v.latency,
      features:v.features||[]
     }));
    } catch (e) {
     console.warn('Detect other_local voices failed', e);
     reports.push({label:categorized.other_local[0].label||'其他本地引擎',package:categorized.other_local[0].package,error:e.message});
    }
   }
  }
  const summary = [];
  if (installedEngines.sherpa) summary.push(`Sherpa (${engineVoices.sherpa.length || 0} 音色)`);
  if (installedEngines.builtin) summary.push(`系统内置 (${engineVoices.builtin.length || 0} 音色)`);
  if (installedEngines.other_local.length) summary.push(`其他本地 (${installedEngines.other_local.length} 引擎)`);
  summary.push(`星栈中转 (${engineVoices.gemini.length} 音色)`);
  if (statusEl) statusEl.textContent = `引擎就绪：${summary.join('、')}。`;
  if(reportEl){
   reportPanel.hidden=!reports.length;
   reportEl.innerHTML=reports.map(({label,package:pkg,result,error})=>{
    if(error)return `<section><b>${escapeHtml(label)}</b><p>读取失败：${escapeHtml(error)}</p></section>`;
    const voices=result.voices||[],caps=result.capabilities||{},installed=voices.filter(v=>v.installed).length;
    const emotion=caps.emotion==='native'?'检测到引擎声明的原生情绪特征：'+(caps.emotionFeatures||[]).join('、'):'未检测到原生情绪接口；角色情绪由插件映射为语速、音高和停顿变化。';
    const voiceRows=voices.map(v=>`<li><b>${escapeHtml(v.name)}</b> · ${escapeHtml(v.language||'未知语言')} · ${v.installed?'已安装':'未下载'} · ${v.networkRequired?'联网':'本地'} · 质量 ${Number.isFinite(v.quality)?v.quality:'未知'} · 延迟 ${Number.isFinite(v.latency)?v.latency+'ms':'未知'}${v.features?.length?' · 能力：'+escapeHtml(v.features.join('、')):''}</li>`).join('');
    return `<section><b>${escapeHtml(label)}</b><small style="display:block;word-break:break-all">${escapeHtml(pkg)}${result.engineVersion?' · 版本 '+escapeHtml(result.engineVersion):''}</small><p>扫描到 ${voices.length} 个音色，已安装 ${installed} 个；本地 ${caps.localVoiceCount??voices.filter(v=>!v.networkRequired).length} 个，联网 ${caps.networkVoiceCount??voices.filter(v=>v.networkRequired).length} 个。可选音色、语速与音高；${emotion}</p><details><summary>查看音色与能力明细</summary><ul style="max-height:260px;overflow:auto;padding-left:22px">${voiceRows||'<li>引擎没有公布音色列表</li>'}</ul></details></section>`;
   }).join('');
  }
  if(activeSession?.result)renderReview(activeSession.result,activeSession);
 } catch (err) {
  if (statusEl) statusEl.textContent = '引擎检测提示：' + err.message;
  if(reportEl){reportPanel.hidden=false;reportEl.textContent='本地模型扫描失败：'+err.message;}
 }finally{
  if(refreshButton){refreshButton.disabled=false;refreshButton.textContent='🔄 刷新本地模型、音色与能力';}
 }
}

export async function init(){
 if(document.querySelector('#xingzhan-synthesis'))return;
 settings=extension_settings.xingzhanSynthesis??={
  selectionEnabled:true,
  speechProvider:'hybrid',
  enginePool:{sherpa:true,gemini:true,builtin:true,sillytavern:false,other_local:false},
  enginePreset:'golden'
 };
 settings.enginePool??={sherpa:true,gemini:true,builtin:true,sillytavern:false,other_local:false};
 settings.enginePreset??='golden';
 settings.mascotEnabled??=true;
 settings.mascotMinimized??=false;
 if(extension_settings.tts?.currentProvider==='星栈 Gemini TTS'){extension_settings.tts.currentProvider='OpenAI Compatible';extension_settings.tts.enabled=false;saveSettingsDebounced();}
 if(extension_settings.sd?.google_api==='xingzhan'){extension_settings.sd.google_api='makersuite';saveSettingsDebounced();}
 const panel=document.createElement('div');panel.id='xingzhan-synthesis';panel.className='extension_container';
 panel.innerHTML=`<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>星栈合成 · 语音与图片</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content">
 <details open><summary><b>上下文配音</b></summary><p>聊天消息旁的“配音”按钮可分析整条消息；长按选中文字后可配音选区。前台窗口中完成审核、生成和播放。</p>
 <label class="checkbox_label"><input type="checkbox" data-selection>启用选中文字后的配音入口</label>
 <div class="xs-actions"><button class="menu_button" type="button" data-open-speech>打开配音窗口</button><button class="menu_button" type="button" data-full-message>配音最新回复</button></div>
 <details><summary>角色音色记忆</summary><p data-memory-status role="status">加载中…</p><div data-memory-list></div></details>
 <details open><summary>文本分析模型</summary>${form('analysis')}</details><details><summary>API 语音生成配置</summary>${form('tts')}</details></details>
 <details open><summary><b>多引擎协同语音</b></summary><p>支持本地 Sherpa (Kokoro-82M)、星栈 Gemini 3.8、安卓系统内置语音多引擎分工。在配音窗口中可选择黄金混合、全离线等协作策略。</p><div class="xs-actions"><button class="menu_button" type="button" data-open-system>打开单引擎系统配音</button><button class="menu_button" type="button" data-panel-detect>检测手机语音引擎</button></div></details>
 <details open><summary><b>图片生成</b></summary><div class="xs-actions" style="margin-bottom:8px;"><button class="menu_button" type="button" data-open-image-dialog style="font-weight:bold;">🎨 打开插图工作台窗口</button></div><textarea class="text_pole" data-image-prompt placeholder="描述要生成的图片"></textarea><p data-image-token-status role="status" style="font-size:0.85em;margin:4px 0"></p><input class="text_pole" data-image-style-hint placeholder="画风偏好（可选，如：日系厚涂、二次元写实、水彩插画）" style="margin-top:6px"><div class="xs-actions" style="margin:8px 0"><button class="menu_button" type="button" data-prompt-from-latest>根据最新回复生成提示词</button><button class="menu_button" type="button" data-prompt-from-selection>根据选区生成提示词</button><button class="menu_button" type="button" data-prompt-cancel disabled>停止生成提示词</button></div><p data-image-prompt-status role="status" style="font-size:0.88em;opacity:0.9;margin:4px 0"></p><label>图片比例<select class="text_pole" data-image-ratio><option>1:1</option><option>3:4</option><option>4:3</option><option>9:16</option><option>16:9</option><option>2:3</option><option>3:2</option></select></label><p>本机 NPU 不调用云端生图；自动构思提示词会调用所选文本模型。</p><div class="xs-actions"><button class="menu_button" type="button" data-image-generate>生成图片</button><button class="menu_button" type="button" data-image-stop disabled>停止生成</button></div>
   <div data-image-queue-panel class="xs-image-queue-panel" style="display:none;margin:8px 0;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.22);border:1px solid var(--SmartThemeBorderColor,#666);">
    <div data-image-queue-active style="display:none;margin-bottom:6px;">
     <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <span style="font-weight:bold;color:#4caf50;">⏳ 正在渲染图片</span>
      <span data-image-queue-elapsed style="font-size:0.85em;opacity:0.85;">已耗时: 0s</span>
     </div>
     <div data-image-queue-prompt style="font-size:0.85em;margin:4px 0;opacity:0.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
     <div class="xs-actions" style="margin-top:4px;gap:6px;">
      <button type="button" class="menu_button xs-mini-btn" data-image-queue-cancel-active style="color:#ff5252!important;font-weight:bold;">⏹ 终止此任务并释放手机资源</button>
     </div>
    </div>
    <div data-image-queue-pending style="display:none;">
     <div style="font-weight:bold;font-size:0.88em;margin-bottom:4px;opacity:0.9;">📋 等待生成队列 (<span data-image-queue-count>0</span>)：</div>
     <div data-image-queue-list style="max-height:120px;overflow-y:auto;font-size:0.82em;display:flex;flex-direction:column;gap:4px;"></div>
    </div>
   </div>
<p data-image-status role="status"></p><img data-image-preview hidden alt="合成结果"><a data-image-link hidden target="_blank" rel="noopener">打开已保存图片</a><details open style="margin-top:12px"><summary><b>当前角色卡图片历史</b> (<span data-image-history-count>0</span>)<button type="button" class="menu_button xs-mini-btn" data-image-history-refresh>刷新</button></summary><div data-image-history-list class="xs-image-history-list"></div></details>${form('image')}</details>
 </div></div>`;
 document.querySelector('#extensions_settings').prepend(panel);
 createSpeechDialog();
 createImageDialog();
 const mascotToggle=document.createElement('label');mascotToggle.className='checkbox_label';mascotToggle.innerHTML='<input type="checkbox" data-mascot-enabled>在酒馆内显示星灯悬浮入口';
 panel.querySelector('.inline-drawer-content').append(mascotToggle);
 const mascot=mountMascot({enabled:settings.mascotEnabled,position:settings.mascotPosition,minimized:settings.mascotMinimized,dockSide:settings.mascotDockSide,dockY:settings.mascotDockY,
  onPosition:position=>{settings.mascotPosition=position;saveSettingsDebounced();},
  onDock:state=>{settings.mascotMinimized=state.minimized;settings.mascotDockSide=state.side;settings.mascotDockY=state.y;saveSettingsDebounced();},
  onHide:()=>{settings.mascotEnabled=false;mascotToggle.querySelector('input').checked=false;saveSettingsDebounced();},
  actions:{
   speech:()=>openSpeech(),
   latest:()=>{const message=[...document.querySelectorAll('#chat .mes')].reverse().find(item=>item.getAttribute('is_user')!=='true'&&item.getAttribute('is_system')!=='true');if(!message)throw Error('当前没有可配音的回复');return openSpeech(messageSpeechData(message));},
   image:()=>openImageDialog(null,{manual:true}),
   chat:()=>{const chat=document.querySelector('#chat');if(!chat)throw Error('聊天界面尚未就绪');chat.scrollTo({top:chat.scrollHeight,behavior:'smooth'});},
   manage:async()=>{if(isGenerating())throw Error('请先停止当前生成');const context=window.SillyTavern?.getContext();if(!context)throw Error('请等待酒馆加载完成');await context.saveChat();await saveSettings();location.href='http://127.0.0.1:8788/manage';}
  }});
 mascotToggle.querySelector('input').checked=settings.mascotEnabled;
 mascotToggle.querySelector('input').addEventListener('change',event=>{settings.mascotEnabled=event.target.checked;mascot.setEnabled(settings.mascotEnabled);saveSettingsDebounced();});
 const openSystem=async detect=>{settings.speechProvider='system';saveSettingsDebounced();await openSpeech();if(detect)await systemSpeech.detect().catch(()=>{});};panel.querySelector('[data-open-system]').onclick=()=>void openSystem(false);panel.querySelector('[data-panel-detect]').onclick=()=>void openSystem(true);
 const selection=panel.querySelector('[data-selection]');selection.checked=settings.selectionEnabled!==false;
 speech=initSelectionTts(()=>settings.selectionEnabled!==false,openSpeech);
 selection.addEventListener('change',()=>{settings.selectionEnabled=selection.checked;if(!selection.checked)speech.stop();saveSettingsDebounced();});
 panel.querySelector('[data-open-speech]').addEventListener('click',()=>openSpeech());
 panel.querySelector('[data-full-message]').addEventListener('click',()=>{const message=[...document.querySelectorAll('#chat .mes')].reverse().find(item=>item.getAttribute('is_user')!=='true'&&item.getAttribute('is_system')!=='true');if(message)openSpeech(messageSpeechData(message));else toastr.info('当前没有可配音的回复，可在配音窗口粘贴整段文本');});
 panel.querySelector('[data-open-image-dialog]')?.addEventListener('click',()=>openImageDialog());
 panel.querySelector('[data-image-generate]').addEventListener('click',()=>void generateImage());
 panel.querySelector('[data-image-prompt]').addEventListener('input',()=>scheduleNpuTokenStatus(panel));
 panel.querySelector('[data-image-stop]').addEventListener('click',()=>void stopImageGeneration());
 panel.querySelector('[data-image-queue-cancel-active]')?.addEventListener('click', ()=>void stopImageGeneration());
 panel.querySelector('[data-prompt-from-latest]').addEventListener('click',()=>runPromptFromLatest());
 panel.querySelector('[data-prompt-from-selection]').addEventListener('click',()=>runPromptFromSelection());
 panel.querySelector('[data-prompt-cancel]').addEventListener('click',()=>imagePromptController?.abort());
 panel.querySelector('[data-image-history-refresh]').addEventListener('click',()=>refreshImageHistory());
 installMessageActions();
 await Promise.all(['tts','image','analysis'].map(kind=>mount(panel.querySelector('[data-kind="'+kind+'"]'),kind)));
 refreshImageHistory().catch(()=>{});
 try{voiceMemory=await loadVoiceMemory();renderMemory();}catch(error){panel.querySelector('[data-memory-status]').textContent='记忆读取失败：'+error.message;}
}

function createSpeechDialog(){
 dialog=document.createElement('dialog');dialog.id='xingzhan-speech-dialog';
 dialog.innerHTML=`<div class="xs-dialog-heading"><button class="menu_button" type="button" data-review-back hidden>返回</button><h3 data-dialog-title>星栈多引擎配音</h3><button class="menu_button" type="button" data-close>关闭</button></div>
 <div class="xs-dialog-body" data-speech-workspace><div data-speech-main>
 <label>配音工作模式<select class="text_pole" data-speech-provider>
   <option value="hybrid">🌟 多引擎协作分流 (推荐)</option>
   <option value="api">星栈 API 云端单引擎</option>
   <option value="system">安卓系统离线单引擎</option>
 </select></label>

 <div class="xs-engine-pool" data-multi-engine-pool>
   <div class="xs-engine-pool-title">
     <span>🎙️ 多引擎协作池（手动选择参与分流的引擎）</span>
     <button type="button" class="menu_button xs-mini-btn" data-detect-all-engines>🔄 刷新本地模型、音色与能力</button>
   </div>
   <div class="xs-preset-bar">
     <span style="font-size:0.85em;align-self:center;opacity:0.85">快捷策略：</span>
     <button type="button" class="menu_button xs-preset-btn" data-preset="golden">🌟 黄金混合</button>
     <button type="button" class="menu_button xs-preset-btn" data-preset="offline">⚡ 100% 纯本地离线</button>
     <button type="button" class="menu_button xs-preset-btn" data-preset="cloud">☁️ 全云端电影级</button>
     <button type="button" class="menu_button xs-preset-btn" data-preset="custom">🛠️ 自定义分工</button>
   </div>
   <div class="xs-engine-list">
     <label class="xs-engine-item">
       <span style="display:flex;align-items:center;gap:6px">
         <input type="checkbox" data-engine-enable="sherpa" checked>
         <b>1. 本地 Sherpa 引擎 (Kokoro-82M)</b>
         <span class="xs-engine-badge" style="background:#2e7d32">24kHz 离线</span>
       </span>
         <small style="opacity:0.8">扫描设备已安装模型及音色；离线合成不消耗 Token</small>
     </label>
     <label class="xs-engine-item">
       <span style="display:flex;align-items:center;gap:6px">
         <input type="checkbox" data-engine-enable="gemini" checked>
         <b>2. 星栈中转 (Gemini 3.8 Flash Lite)</b>
         <span class="xs-engine-badge" style="background:#1565c0">云端高表现力</span>
       </span>
       <small style="opacity:0.8">细腻戏感情绪，剧本级演绎，适合主角对白/高戏剧性片段</small>
     </label>
     <label class="xs-engine-item">
       <span style="display:flex;align-items:center;gap:6px">
         <input type="checkbox" data-engine-enable="builtin" checked>
         <b>3. 安卓系统内置引擎 (Heytap/小布/Google)</b>
         <span class="xs-engine-badge" style="background:#ef6c00">极轻量零内存</span>
       </span>
       <small style="opacity:0.8">系统原厂发音，秒开低耗，适合环境音/杂役龙套</small>
     </label>
     <label class="xs-engine-item">
       <span style="display:flex;align-items:center;gap:6px">
         <input type="checkbox" data-engine-enable="sillytavern">
         <b>4. 酒馆自带引擎 (SillyTavern TTS)</b>
         <span class="xs-engine-badge" style="background:#6a1b9a">扩展兼容</span>
       </span>
       <small style="opacity:0.8">Edge-TTS / XTTS / Bark，支持酒馆扩展已有发音人</small>
     </label>
     <label class="xs-engine-item">
       <span style="display:flex;align-items:center;gap:6px">
         <input type="checkbox" data-engine-enable="other_local">
         <b>5. 安装的其他本地引擎 (第三方 TTS 服务)</b>
         <span class="xs-engine-badge" style="background:#455a64">系统服务</span>
       </span>
       <small style="opacity:0.8">TTS-Server、外部离线语音服务</small>
     </label>
   </div>
   <p data-engine-pool-status role="status" style="font-size:0.84em;margin:6px 0 0 0;opacity:0.9"></p><details data-local-model-report hidden><summary>本地模型能力与音色清单</summary><div data-local-model-report-content></div></details>
 </div>

 <p data-card-scope></p><div data-api-history><label>已保存的配音记录<select class="text_pole" data-session-list><option value="">暂无记录</option></select></label><button class="menu_button" type="button" data-session-restore>恢复所选记录</button></div><label>配音范围<select class="text_pole" data-scope><option value="selection">选中文字</option><option value="full">整条消息 / 整段文本</option></select></label>
 <textarea class="text_pole" data-speech-text aria-label="待配音文本" placeholder="粘贴整段文本，或从聊天消息的配音按钮打开"></textarea>
 <label class="checkbox_label"><input type="checkbox" data-world-reference>参考当前角色卡关联世界书</label><p>只发送与正文匹配的条目摘要给文本分析 API；世界书不作为朗读正文。关键词匹配可能漏掉人物。</p><p data-world-status role="status"></p><details><summary>分析诊断日志</summary><label class="checkbox_label"><input type="checkbox" data-analysis-diagnostics>记录完整请求与回复（仅本机，含正文；关闭后仍保留编号错误摘要）</label><div class="xs-actions"><button class="menu_button" type="button" data-analysis-log-view>查看当前角色卡日志</button><button class="menu_button" type="button" data-analysis-log-clear>清空诊断日志</button></div><pre data-analysis-log-output style="white-space:pre-wrap;word-break:break-word;max-height:350px;overflow:auto"></pre></details>
 <section data-api-workspace><p>智能拆分剧本台词与旁白，为各角色分配最优引擎。超过 12000 字自动分批，最多 120000 字。</p><label class="checkbox_label"><input type="checkbox" data-context checked>结合附近最多 5 条消息分析</label>
 <div class="xs-actions"><button class="menu_button" type="button" data-analyze>分析整段文本</button><button class="menu_button" type="button" data-cancel-analysis disabled>取消分析</button></div>
 <p data-analysis-status role="status"></p><div data-review hidden></div><section data-api-playback hidden></section>
 <label class="checkbox_label"><input type="checkbox" data-remember checked>生成成功后记住我确认的角色音色和分工设置</label></section><div class="xs-actions"><button class="menu_button" type="button" data-open-review disabled>查看分析结果</button></div></div><section data-review-page hidden><p>在此审核角色、分工引擎、音色与逐段情绪，返回一级页面生成语音。审核修改和已生成音频会保留。</p><div data-api-review-page></div><div data-system-review-page hidden></div></section></div>`;
 document.body.append(dialog);workspace=dialog.querySelector('[data-speech-workspace]');
 const worldToggle=workspace.querySelector('[data-world-reference]');worldToggle.checked=settings.worldReferenceEnabled!==false;worldToggle.onchange=()=>{settings.worldReferenceEnabled=worldToggle.checked;saveSettingsDebounced();invalidate();void refreshWorldReferences();};
 const diagnostic=workspace.querySelector('[data-analysis-diagnostics]');diagnostic.checked=settings.analysisDiagnostics!==false;diagnostic.onchange=()=>{settings.analysisDiagnostics=diagnostic.checked;saveSettingsDebounced();};
 workspace.querySelector('[data-analysis-log-view]').onclick=async()=>{const scope=activeScope||currentSpeechScope(),output=workspace.querySelector('[data-analysis-log-output]');try{const data=await (await mediaRequest('analysis-diagnostics?scope='+encodeURIComponent(scope.id))).json();if((activeScope||currentSpeechScope()).id===scope.id)output.textContent=data.records.length?JSON.stringify(data,null,2):'暂无诊断记录；下次分析会保存校验摘要，开启完整记录后还会保存请求与回复正文。';}catch(error){output.textContent=error.message;}};
 workspace.querySelector('[data-analysis-log-clear]').onclick=async()=>{try{await mediaRequest('analysis-diagnostics/clear',{scopeId:(activeScope||currentSpeechScope()).id});workspace.querySelector('[data-analysis-log-output]').textContent='诊断日志已清空。';}catch(error){workspace.querySelector('[data-analysis-log-output]').textContent=error.message;}};
 const apiPage=workspace.querySelector('[data-api-review-page]');apiPage.append(workspace.querySelector('[data-review]'));
 systemSpeech=mountSystemSpeech(workspace,settings,()=>showReviewPage(true));workspace.querySelector('[data-speech-main]').append(systemSpeech.host,workspace.querySelector('[data-open-review]').parentElement);
 workspace.querySelector('[data-open-review]').onclick=()=>showReviewPage(true);dialog.querySelector('[data-review-back]').onclick=()=>showReviewPage(false);
 workspace.addEventListener('xs-review-update',updateReviewEntry);
 new MutationObserver(updateReviewEntry).observe(workspace,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});

 // Engine pool checkbox binding
 for(const eng of ['sherpa','gemini','builtin','sillytavern','other_local']){
  const cb=workspace.querySelector(`[data-engine-enable="${eng}"]`);
  if(cb){
   cb.checked=!!settings.enginePool[eng];
   cb.onchange=()=>{
    settings.enginePool[eng]=cb.checked;
    settings.enginePreset='custom';
    saveSettingsDebounced();
    updatePresetHighlight();
    if(activeSession?.result)renderReview(activeSession.result,activeSession);
   };
  }
 }

 // Presets buttons binding
 for(const [presetKey,preset] of Object.entries(ENGINE_PRESETS)){
  const btn=workspace.querySelector(`[data-preset="${presetKey}"]`);
  if(btn){
   btn.onclick=()=>{
    if(preset.pool){
     settings.enginePool={...preset.pool};
     for(const eng of Object.keys(preset.pool)){
      const cb=workspace.querySelector(`[data-engine-enable="${eng}"]`);
      if(cb)cb.checked=preset.pool[eng];
     }
    }
    settings.enginePreset=presetKey;
    saveSettingsDebounced();
    updatePresetHighlight();
    toastr.info(`已应用预设：${preset.name}`);
    if(activeSession?.result)renderReview(activeSession.result,activeSession);
   };
  }
 }

 function updatePresetHighlight(){
  for(const p of Object.keys(ENGINE_PRESETS)){
   const btn=workspace.querySelector(`[data-preset="${p}"]`);
   if(btn){
    if(settings.enginePreset===p)btn.classList.add('active');
    else btn.classList.remove('active');
   }
  }
 }
 updatePresetHighlight();

 workspace.querySelector('[data-detect-all-engines]').onclick=()=>void detectAllEngines();

 workspace.querySelector('[data-speech-provider]').onchange=async event=>{
  void persistDraft().catch(()=>{});
  cancelWork();
  settings.speechProvider=event.target.value;
  saveSettingsDebounced();
  showSpeechProvider();
  if(event.target.value==='system')await systemSpeech.open(activeScope||currentSpeechScope(),workspace.querySelector('[data-speech-text]').value,true);
  else{
   systemSpeech.stop();
   await openSpeech({...(source||{}),text:workspace.querySelector('[data-speech-text]').value,scope:workspace.querySelector('[data-scope]').value,cardScope:activeScope||currentSpeechScope()});
  }
 };
 showSpeechProvider();

 dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(dialog.open)return;void persistDraft().catch(()=>{});cancelWork();systemSpeech.stop();workspace.querySelector('[data-review]').hidden=true;speech?.stop();});
 workspace.querySelector('[data-session-restore]').addEventListener('click',async()=>{try{await persistDraft();cancelWork();await restoreRecord(workspace.querySelector('[data-session-list]').value);}catch(error){workspace.querySelector('[data-analysis-status]').textContent='恢复失败：'+error.message;}});
 workspace.querySelector('[data-scope]').value='full';
 workspace.querySelector('[data-analyze]').addEventListener('click',()=>void runAnalysis());
 workspace.querySelector('[data-cancel-analysis]').addEventListener('click',()=>analysisController?.abort());
 workspace.querySelector('[data-scope]').addEventListener('change',event=>{invalidate();workspace.querySelector('[data-speech-text]').value=event.target.value==='full'?source?.fullText||'':source?.text||'';updateAnalyzeLabel();});
 workspace.querySelector('[data-speech-text]').addEventListener('input',()=>{invalidate();source=null;workspace.querySelector('[data-scope]').value='full';updateAnalyzeLabel();});
 workspace.querySelector('[data-context]').addEventListener('change',invalidate);
}

function updateAnalyzeLabel(){workspace.querySelector('[data-analyze]').textContent=workspace.querySelector('[data-scope]').value==='selection'?'分析选中文字':'分析整段文本';}
async function refreshWorldReferences(){const ticket=epoch,text=workspace.querySelector('[data-speech-text]').value,output=workspace.querySelector('[data-world-status]');if(!workspace.querySelector('[data-world-reference]').checked){output.textContent='世界书参考已关闭。';return;}output.textContent='正在读取关联世界书（不调用模型）…';try{const refs=await loadSpeechWorldReferences(text,source?.context||[],undefined,activeScope?.id);if(ticket===epoch)output.textContent=worldReferenceStatus(refs);}catch(error){if(ticket===epoch)output.textContent='世界书读取失败：'+error.message+'；可关闭世界书参考后分析。';}}
function updateReviewEntry(){const playback=workspace.querySelector('[data-api-playback]'),hidden=workspace.querySelector('[data-review]').hidden;if(playback.hidden!==hidden)playback.hidden=hidden;const system=settings.speechProvider==='system',review=workspace.querySelector(system?'[data-system-review]':'[data-review]'),button=workspace.querySelector('[data-open-review]');button.disabled=review.hidden;const label=review.hidden?'查看分析结果':'审核分析结果'+(review.dataset.reviewDoubts?' · '+review.dataset.reviewDoubts+' 处疑点':'');if(button.textContent!==label)button.textContent=label;}
function showReviewPage(review){const system=settings.speechProvider==='system';if(review&&workspace.querySelector(system?'[data-system-review]':'[data-review]').hidden)return;workspace.querySelector('[data-speech-main]').hidden=review;workspace.querySelector('[data-review-page]').hidden=!review;workspace.querySelector('[data-api-review-page]').hidden=system;workspace.querySelector('[data-system-review-page]').hidden=!system;dialog.querySelector('[data-review-back]').hidden=!review;dialog.querySelector('[data-dialog-title]').textContent=review?'分析结果':'星栈多引擎配音';workspace.scrollTop=0;updateReviewEntry();}
function showSpeechProvider(){
 showReviewPage(false);
 const mode=settings.speechProvider||'hybrid';
 workspace.querySelector('[data-speech-provider]').value=mode;
 const isSystem=mode==='system';
 workspace.querySelector('[data-multi-engine-pool]').hidden=isSystem;
 workspace.querySelector('[data-api-workspace]').hidden=isSystem;
 workspace.querySelector('[data-api-history]').hidden=isSystem;
 systemSpeech.host.hidden=!isSystem;
}

function cancelWork(){
 epoch++;
 analysisController?.abort();
 generationController?.abort();
 analysisController=null;
 generationController=null;
 clearTimeout(pauseTimer);
 if(activePreview){activePreview.audio.pause();activePreview.btn.textContent='▶ 试听';activePreview=null;}
 clearAudio();
 workspace?.querySelector('[data-analyze]')?.removeAttribute('disabled');
 if(workspace)workspace.querySelector('[data-cancel-analysis]').disabled=true;
}

function clearAudio(){
 clearTimeout(pauseTimer);
 const audio=workspace?.querySelector('[data-api-playback] audio');
 if(audio){audio.pause();audio.removeAttribute('src');audio.load();}
 for(const url of playQueue)if(typeof url==='string'&&url.startsWith('blob:'))URL.revokeObjectURL(url);
 playQueue=[];playIndex=0;
}

function invalidate(){void persistDraft().catch(()=>{});activeSession=null;cancelWork();systemSpeech.invalidate();workspace.querySelector('[data-review]').hidden=true;workspace.querySelector('[data-analysis-status]').textContent='文本或范围已更新，请重新分析。';}
function persistDraft(){
 clearTimeout(draftTimer);if(!activeSession)return draftTail;
 const scope={...activeScope},record=JSON.parse(JSON.stringify(activeSession));delete record.scope;
 draftTail=draftTail.catch(()=>{}).then(()=>saveSpeechSession(record,scope)).then(saved=>{if(activeSession?.id===saved.id){activeSession.audio=saved.audio;activeSession.updatedAt=saved.updatedAt;activeSession.reviewRevision=saved.reviewRevision;workspace.querySelector('[data-analysis-status]').textContent='审核结果已自动保存。';}return saved;});
 return draftTail.catch(error=>{workspace.querySelector('[data-analysis-status]').textContent='保存失败：'+error.message;throw error;});
}
function scheduleDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>void persistDraft().catch(()=>{}),300);}
async function refreshSessions(){const data=await listSpeechSessions(activeScope),records=data.sessions.filter(x=>x.provider!=='system'),select=workspace.querySelector('[data-session-list]');select.innerHTML='<option value="">选择已保存记录</option>'+records.map(x=>`<option value="${x.id}">${escapeHtml(x.text.slice(0,25))} · ${x.audioCount}/${x.total} 段 · ${escapeHtml(new Date(x.updatedAt).toLocaleString())}</option>`).join('');return records;}
async function restoreRecord(id,token=epoch){if(!id)return;await draftTail.catch(()=>{});const record=await loadSpeechSession(id,activeScope);if(token!==epoch)return;activeSession=record;source=record.source;workspace.querySelector('[data-speech-text]').value=record.text;renderReview(record.result,record);workspace.querySelector('[data-session-list]').value=record.id;workspace.querySelector('[data-analysis-status]').textContent='已恢复保存的分析、音色和音频。';}

export async function openSpeech(data){
 await persistDraft().catch(()=>{});cancelWork();systemSpeech.stop();showSpeechProvider();const token=epoch;activeSession=null;activeScope=data?.cardScope||currentSpeechScope();
 workspace.querySelector('[data-analysis-log-output]').textContent='';workspace.querySelector('[data-review]').hidden=true;workspace.querySelector('[data-card-scope]').textContent='独立配音库：'+activeScope.label+'；多引擎分工、审核及音频自动保存到本机。';
 if(data){source=data;workspace.querySelector('[data-speech-text]').value=data.text||'';workspace.querySelector('[data-scope]').value=data.scope||'full';workspace.querySelector('[data-analysis-status]').textContent='已带入文本；正在检查已保存记录…';}
 workspace.querySelector('[data-scope] option[value="selection"]').disabled=source?.scope!=='selection';updateAnalyzeLabel();speech?.stop();if(!dialog.open)dialog.showModal();void refreshWorldReferences();
 setTimeout(() => void detectAllEngines().catch(()=>{}), 150);
 if(settings.speechProvider==='system'){await systemSpeech.open(activeScope,workspace.querySelector('[data-speech-text]').value,!!data,source);return;}
 try{voiceMemory=await loadVoiceMemory(activeScope);if(token!==epoch)return;renderMemory();const records=await refreshSessions();if(token!==epoch)return;
  if(!data&&records[0])await restoreRecord(records[0].id,token);
  else if(data){for(const item of records.filter(x=>x.text===data.text.slice(0,80))){const record=await loadSpeechSession(item.id,activeScope);if(token!==epoch)return;if(record.text===data.text){await restoreRecord(item.id,token);return;}}workspace.querySelector('[data-analysis-status]').textContent='已带入文本，点击分析开始。';}
 }catch(error){if(token===epoch)workspace.querySelector('[data-analysis-status]').textContent='配音库读取失败：'+error.message;}
}

function getImageRoots(){
 return [imageDialog,document.querySelector('#xingzhan-synthesis')].filter(Boolean);
}

const npuTokenTimers=new WeakMap();
function scheduleNpuTokenStatus(root){
 const previous=npuTokenTimers.get(root);if(previous)clearTimeout(previous);
 npuTokenTimers.set(root,setTimeout(()=>void refreshNpuTokenStatus(root),300));
}
async function refreshNpuTokenStatus(root){
 const input=root.querySelector('[data-image-prompt]'),status=root.querySelector('[data-image-token-status]');
 if(!input||!status)return;
 const prompt=input.value.trim();if(!prompt){status.textContent='';return;}
 try{
  const cfg=await mediaRequest('config/image').then(r=>r.json());
  if(input.value.trim()!==prompt)return;
  if(cfg.source!=='npu'){status.textContent='';return;}
  const tokens=await tokenizeNpuImagePrompt(prompt);
  if(input.value.trim()!==prompt)return;
  const positive=tokens.positive,negative=tokens.negative;
  const over=positive.count>positive.maxLength||negative.count>negative.maxLength;
  status.dataset.state=over?'error':positive.count>70?'warning':'ok';
  status.textContent='本机 NPU：正面 '+positive.count+'/'+positive.maxLength+' token · 负面 '+negative.count+'/'+negative.maxLength+(over?'；已超限，请先精简':'');
  if(positive.count>positive.maxLength&&positive.overflowOffset>=0)status.textContent+='；超出部分从「'+prompt.slice(positive.overflowOffset,positive.overflowOffset+50)+'」开始';
 }catch(error){
  if(input.value.trim()!==prompt)return;
  status.dataset.state='warning';status.textContent='本机 NPU token：'+error.message;
 }
}

function createImageDialog(){
 if(document.querySelector('#xingzhan-image-dialog'))return;
 imageDialog=document.createElement('dialog');
 imageDialog.id='xingzhan-image-dialog';
 imageDialog.innerHTML=`<div class="xs-dialog-heading">
  <h3 data-image-dialog-title>🎨 星栈插图生成工作台</h3>
  <button class="menu_button" type="button" data-image-dialog-close>关闭</button>
 </div>
 <div class="xs-dialog-body" data-image-workspace>
  <div data-image-source-info style="font-size:0.88em;opacity:0.85;margin-bottom:8px;padding:8px 12px;background:rgba(255,255,255,0.06);border-radius:6px;border-left:3px solid var(--SmartThemeQuoteColor,#2979ff);"></div>

  <div data-image-quick-bar style="display:flex;align-items:center;gap:8px;margin:4px 0 10px 0;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:6px;border:1px solid rgba(255,255,255,0.12);">
   <span style="font-size:0.88em;white-space:nowrap;font-weight:bold;">🖼️ 生图引擎/模型:</span>
   <select data-image-quick-model class="text_pole" style="flex:1;font-size:0.88em;padding:4px 6px;margin:0;"></select>
   <button type="button" class="menu_button xs-mini-btn" data-image-quick-refresh title="刷新模型列表" style="margin:0;padding:4px 8px;">🔄</button>
  </div>

  <label>提示词 (Prompt)</label>
  <textarea class="text_pole" data-image-prompt placeholder="描述要生成的画面主体、外貌、动作、服装、光影与背景"></textarea>
  <p data-image-token-status role="status" style="font-size:0.85em;margin:4px 0"></p>

  <div style="display:grid;grid-template-columns:1fr 140px;gap:8px;margin-top:6px;">
   <div>
    <label>画风偏好（可选）</label>
    <input class="text_pole" data-image-style-hint placeholder="如：日系厚涂、二次元写实、精致古风、赛博朋克">
   </div>
   <div>
    <label>画面比例</label>
    <select class="text_pole" data-image-ratio>
     <option value="1:1">1:1 (方图)</option>
     <option value="3:4" selected>3:4 (立绘推荐)</option>
     <option value="4:3">4:3 (横幅)</option>
     <option value="9:16">9:16 (手机壁纸)</option>
     <option value="16:9">16:9 (电脑壁纸)</option>
     <option value="2:3">2:3 (经典人像)</option>
     <option value="3:2">3:2 (经典横版)</option>
    </select>
   </div>
  </div>

  <div class="xs-actions" style="margin:10px 0;gap:6px;display:flex;flex-wrap:wrap;">
   <button class="menu_button" type="button" data-image-generate style="font-weight:bold;background:var(--SmartThemeQuoteColor,#2979ff)!important;color:#fff!important;">🎨 生成图片</button>
   <button class="menu_button" type="button" data-image-stop disabled style="font-weight:bold;color:#ff5252!important;border:1px solid rgba(255,82,82,0.4)!important;">⏹️ 强行停止生图</button>
   <button class="menu_button" type="button" data-prompt-rethink>🔄 重新构思提示词</button>
   <button class="menu_button" type="button" data-prompt-cancel disabled>停止构思</button>
  </div>

   <div data-image-queue-panel class="xs-image-queue-panel" style="display:none;margin:8px 0;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.22);border:1px solid var(--SmartThemeBorderColor,#666);">
    <div data-image-queue-active style="display:none;margin-bottom:6px;">
     <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <span style="font-weight:bold;color:#4caf50;">⏳ 正在渲染图片</span>
      <span data-image-queue-elapsed style="font-size:0.85em;opacity:0.85;">已耗时: 0s</span>
     </div>
     <div data-image-queue-prompt style="font-size:0.85em;margin:4px 0;opacity:0.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
     <div class="xs-actions" style="margin-top:4px;gap:6px;">
      <button type="button" class="menu_button xs-mini-btn" data-image-queue-cancel-active style="color:#ff5252!important;font-weight:bold;">⏹ 终止此任务并释放手机资源</button>
     </div>
    </div>
    <div data-image-queue-pending style="display:none;">
     <div style="font-weight:bold;font-size:0.88em;margin-bottom:4px;opacity:0.9;">📋 等待生成队列 (<span data-image-queue-count>0</span>)：</div>
     <div data-image-queue-list style="max-height:120px;overflow-y:auto;font-size:0.82em;display:flex;flex-direction:column;gap:4px;"></div>
    </div>
   </div>

  <p data-image-status role="status" style="font-weight:bold;margin:6px 0;"></p>
  <p data-image-prompt-status role="status" style="font-size:0.88em;opacity:0.9;margin:4px 0;"></p>

  <div data-image-preview-box style="margin:12px 0;text-align:center;">
   <img data-image-preview hidden alt="合成结果" style="max-width:100%;max-height:48vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);object-fit:contain;">
   <div class="xs-actions" style="justify-content:center;margin-top:8px;">
    <a data-image-link hidden class="menu_button" target="_blank" rel="noopener">在新窗口查看原图</a>
   </div>
  </div>

  <details style="margin-top:12px;border:1px solid var(--SmartThemeBorderColor,#888);border-radius:8px;padding:8px;">
   <summary style="cursor:pointer;font-weight:bold;">⚙️ 生图引擎配置 (本地 SD / 云端中转)</summary>
   ${form('image')}
  </details>

  <details open style="margin-top:12px;border:1px solid var(--SmartThemeBorderColor,#888);border-radius:8px;padding:8px;">
   <summary style="cursor:pointer;font-weight:bold;">🖼️ 当前角色卡图片历史 (<span data-image-history-count>0</span>) <button type="button" class="menu_button xs-mini-btn" data-image-history-refresh>刷新</button></summary>
   <div data-image-history-list class="xs-image-history-list"></div>
  </details>
 </div>`;

 document.body.append(imageDialog);
 imageDialog.querySelector('[data-image-dialog-close]').onclick=()=>imageDialog.close();
 imageDialog.querySelector('[data-image-generate]').onclick=()=>void generateImage();
 imageDialog.querySelector('[data-image-prompt]').addEventListener('input',()=>scheduleNpuTokenStatus(imageDialog));
 imageDialog.querySelector('[data-image-stop]').onclick=()=>void stopImageGeneration();
 imageDialog.querySelector('[data-image-queue-cancel-active]')?.addEventListener('click', ()=>void stopImageGeneration());
 imageDialog.querySelector('[data-prompt-cancel]').onclick=()=>imagePromptController?.abort();
 imageDialog.querySelector('[data-image-history-refresh]').onclick=()=>refreshImageHistory();
 imageDialog.querySelector('[data-prompt-rethink]').onclick=()=>{
  let source=lastImageSource;
  if(!source||!source.text){
   const latestMessage=[...document.querySelectorAll('#chat .mes')].reverse().find(item=>item.getAttribute('is_user')!=='true'&&item.getAttribute('is_system')!=='true')||document.querySelector('#chat .mes');
   if(latestMessage)source=messageSpeechData(latestMessage);
   else source=currentCardImageSource();
  }
  if(source&&source.text){
   lastImageSource=source;
   const sourceInfo=imageDialog.querySelector('[data-image-source-info]');
   if(sourceInfo){
    sourceInfo.textContent='剧情参考：'+(source.label||'当前对话')+' —— '+source.text.slice(0,100)+(source.text.length>100?'…':'');
    sourceInfo.hidden=false;
   }
   runImagePromptTask(source.text,source.context||[],source.label||'当前对话',source);
  }else{
   toastr.info('暂无关联剧情或角色卡素材，请在提示词框中直接输入');
  }
 };
 mount(imageDialog.querySelector('[data-kind="image"]'),'image').catch(()=>{});
 syncWorkbenchModels(imageDialog);
 imageDialog.querySelector('[data-image-quick-refresh]')?.addEventListener('click', (e) => {
  e.preventDefault();
  syncWorkbenchModels(imageDialog);
 });
}

async function syncWorkbenchModels(dialog) {
 const select = dialog.querySelector('[data-image-quick-model]');
 if (!select) return;
 try {
  const cfg = await (await mediaRequest('config/image')).json();
  const st = await (await mediaRequest('local-engine/status')).json();
  select.replaceChildren();

  // Local models optgroup
  const localGroup = document.createElement('optgroup');
  localGroup.label = '📱 本地离线 SD 模型 (0 Token / 无审查)';
  if (Array.isArray(st.allModels) && st.allModels.length > 0) {
   for (const m of st.allModels) {
    const isCur = cfg.source === 'local' && (m.name === (cfg.selectedModel || st.selectedModel || st.modelName));
    const label = m.isComplete === false
     ? '⚠️ 本地: ' + m.name + ' (' + m.sizeMb + 'MB · 缺CLIP不可单跑)'
     : '✅ 本地: ' + m.name + ' (' + m.sizeMb + 'MB · 完整版)';
    const opt = new Option(label, 'local:' + m.name);
    if (isCur) opt.selected = true;
    localGroup.appendChild(opt);
   }
  } else {
   const emptyOpt = new Option('未发现本地模型 (请放入 tools/local-sd)', 'local:none');
   emptyOpt.disabled = true;
   localGroup.appendChild(emptyOpt);
  }
  select.appendChild(localGroup);

  const npuGroup=document.createElement('optgroup');npuGroup.label='⚡ 本机 NPU 模型';
  const npu=await mediaRequest('npu/status').then(r=>r.json()).catch(()=>({models:[]}));
  for(const item of npu.models||[]){const opt=new Option((npu.running&&npu.modelName===item.name?'✅ ':'⚡ ')+item.name,'npu:'+item.name);if(cfg.source==='npu'&&cfg.selectedModel===item.name)opt.selected=true;npuGroup.appendChild(opt);}
  if(!npuGroup.children.length){const opt=new Option('尚未导入 NPU 模型','npu:none');opt.disabled=true;npuGroup.appendChild(opt);}
  select.appendChild(npuGroup);

  // Cloud relay optgroup
  const relayGroup = document.createElement('optgroup');
  relayGroup.label = '☁️ 云端中转模型';
  const relayModels = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];
  if (cfg.model && !relayModels.includes(cfg.model)) relayModels.unshift(cfg.model);
  for (const rm of relayModels) {
   const isCur = cfg.source === 'relay' && cfg.model === rm;
   const opt = new Option('云端: ' + rm, 'relay:' + rm);
   if (isCur) opt.selected = true;
   relayGroup.appendChild(opt);
  }
  select.appendChild(relayGroup);

  if (!select.dataset.bound) {
   select.dataset.bound = 'true';
   select.addEventListener('change', async () => {
    const val = select.value;
    const statusText = dialog.querySelector('[data-image-status]');
    try {
     const curCfg = await (await mediaRequest('config/image')).json();
     if (val.startsWith('local:')) {
      const modelName = val.slice(6);
      if (modelName === 'none') return;
      const chosenObj = st.allModels?.find(m => m.name === modelName);
      if (chosenObj && chosenObj.isComplete === false) {
       if (window.toastr?.warning) window.toastr.warning('提示：「' + modelName + '」为纯 UNet 降噪切片（缺少内置 CLIP 文本编码器），系统生图时将自动平替为完整版模型出图。');
      }
      await mediaRequest('config/image', { ...curCfg, source: 'local', selectedModel: modelName });
      await mediaRequest('local-engine/start', {});
      if (statusText) {
       statusText.textContent = (chosenObj && chosenObj.isComplete === false ? '已选模型: ' + modelName + ' (自动完整模型平替)' : '已切换为本地模型: ' + modelName);
       statusText.style.color = '#4caf50';
      }
      if (window.toastr?.success) window.toastr.success('已切换为本地模型: ' + modelName);
     } else if (val.startsWith('npu:')) {
      const modelName=val.slice(4);if(modelName==='none')return;
      await mediaRequest('npu/select',{model:modelName});
      await mediaRequest('npu/start',{model:modelName});
      if(statusText)statusText.textContent='已启动本机 NPU：'+modelName;
     } else if (val.startsWith('relay:')) {
      const relayModel = val.slice(6);
      await mediaRequest('config/image', { ...curCfg, source: 'relay', model: relayModel });
      if (statusText) {
       statusText.textContent = '已切换为云端模型: ' + relayModel;
       statusText.style.color = '#4caf50';
      }
      if (window.toastr?.success) window.toastr.success('已切换为云端中转: ' + relayModel);
     }
     await syncWorkbenchModels(dialog);
     scheduleNpuTokenStatus(dialog);
     mount(dialog.querySelector('[data-kind="image"]'), 'image').catch(() => {});
    } catch (e) {
     if (statusText) {
      statusText.textContent = '切换失败: ' + e.message;
      statusText.style.color = '#f44336';
     }
     if (window.toastr?.error) window.toastr.error('切换失败: ' + e.message);
    }
   });
  }
 } catch (err) {
  console.error('[Workbench] Failed to sync models:', err);
 }
}

export async function openImageDialog(data,options={}){
 if(!imageDialog)createImageDialog();
 syncImageQueueUI().catch(()=>{});
 if(options.manual)lastImageSource=null;
 if(!data&&!lastImageSource&&!options.manual){
  const latestMessage=[...document.querySelectorAll('#chat .mes')].reverse().find(item=>item.getAttribute('is_user')!=='true'&&item.getAttribute('is_system')!=='true')||document.querySelector('#chat .mes');
  if(latestMessage)data=messageSpeechData(latestMessage);
  else data=currentCardImageSource();
 }
 activeScope=data?.cardScope||currentSpeechScope();
 if(imageDialog)syncWorkbenchModels(imageDialog);
 const sourceInfo=imageDialog.querySelector('[data-image-source-info]');
 const status=imageDialog.querySelector('[data-image-status]');
 const promptStatus=imageDialog.querySelector('[data-image-prompt-status]');
 const promptInput=imageDialog.querySelector('[data-image-prompt]');
 const preview=imageDialog.querySelector('[data-image-preview]');
 const link=imageDialog.querySelector('[data-image-link]');

 if(preview)preview.hidden=true;
 if(link)link.hidden=true;
 if(status)status.textContent='';
 if(promptStatus)promptStatus.textContent='';
 scheduleNpuTokenStatus(imageDialog);

 if(data){
  lastImageSource=data;
  if(sourceInfo){
   sourceInfo.textContent='剧情参考：'+(data.label||'当前对话')+' —— '+data.text.slice(0,100)+(data.text.length>100?'…':'');
   sourceInfo.hidden=false;
  }
 }else{
  if(sourceInfo)sourceInfo.hidden=true;
 }

 if(!imageDialog.open)imageDialog.showModal();
 refreshImageHistory().catch(()=>{});

 if(data&&data.text){
  await runImagePromptTask(data.text,data.context||[],data.label||'当前对话',data);
 }
}

function installMessageActions(){
 const chat=document.querySelector('#chat');if(!chat)return;
 const add=()=>{for(const message of chat.querySelectorAll('.mes')){if(message.querySelector('[data-xs-speech]'))continue;const target=message.querySelector('.mes_block');if(!target)continue;const row=document.createElement('div');row.className='xs-message-actions';const button=document.createElement('button');button.type='button';button.dataset.xsSpeech='';button.className='xs-chat-speech';button.textContent='配音整条消息';button.title='分析并配音整条消息';button.addEventListener('click',event=>{event.stopPropagation();openSpeech(messageSpeechData(message));});const imgBtn=document.createElement('button');imgBtn.type='button';imgBtn.className='xs-chat-speech';imgBtn.textContent='生成插图';imgBtn.title='构思插图并打开生成工作台';imgBtn.addEventListener('click',event=>{event.stopPropagation();openImageDialog(messageSpeechData(message));});row.append(button,imgBtn);target.append(row);}};
 add();let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(add,100);}).observe(chat,{childList:true,subtree:true});
}

function renderMemory(){const panel=document.querySelector('#xingzhan-synthesis'),target=panel.querySelector('[data-memory-list]');target.replaceChildren();panel.querySelector('[data-memory-status]').textContent=`已保存 ${voiceMemory.characters.length} 条当前角色卡的确认记忆；配音正文和音频保存在本机`;
 for(const item of voiceMemory.characters){const row=document.createElement('div');row.className='xs-memory-row';row.innerHTML=`<b>${escapeHtml(item.displayName||item.characterId)}</b><span>${escapeHtml(getEngineLabel(item.engine||'gemini'))} · ${escapeHtml(item.voiceId)}</span><small>${escapeHtml(item.summary||'')}</small><button type="button" class="menu_button">删除</button>`;row.querySelector('button').addEventListener('click',async()=>{try{voiceMemory=await saveVoiceMemory(voiceMemory.characters.filter(entry=>entry.characterId!==item.characterId),activeScope||currentSpeechScope());renderMemory();}catch(error){toastr.error(error.message);}});target.append(row);}}

async function runAnalysis(){
 const text=workspace.querySelector('[data-speech-text]').value;if(!text.trim()){toastr.info('请先选择或粘贴要分析的文本');return;}if(text.length>120000){workspace.querySelector('[data-analysis-status]').textContent='整段文本超过 120000 字，请拆成多个配音任务；不会截断提交。';return;}
 cancelWork();const id=epoch,controller=new AbortController();analysisController=controller;
 const status=workspace.querySelector('[data-analysis-status]'),button=workspace.querySelector('[data-analyze]');button.disabled=true;workspace.querySelector('[data-cancel-analysis]').disabled=false;workspace.querySelector('[data-review]').hidden=true;status.textContent='正在分析整段内容、角色和语气…';
 const requestId=crypto.randomUUID(),scope={...activeScope};let polling=false;const progressTimer=setInterval(async()=>{if(polling||id!==epoch)return;polling=true;try{const progress=await (await mediaRequest('analysis-progress/'+requestId+'?scope='+encodeURIComponent(scope.id))).json();if(id===epoch&&progress.total&&progress.state==='running')status.textContent=`正在分批分析：已保存 ${progress.completed}/${progress.total} 批；输出超限会自动缩小批次…`;}catch{}finally{polling=false;}},1500);
 try{const result=await analyzeSpeech(text,workspace.querySelector('[data-context]').checked?source?.context||[]:[],controller.signal,{scopeId:scope.id,scopeLabel:scope.label,source,analysisRequestId:requestId,analysisDiagnostics:workspace.querySelector('[data-analysis-diagnostics]').checked});if(id!==epoch)return;activeSession=await loadSpeechSession(result.sessionId,scope);if(id!==epoch)return;renderReview(activeSession.result,activeSession);await refreshSessions();status.textContent=`分析已保存${result.analysisChunks>1?'（'+result.analysisChunks+' 批已合并）':''}。可修改分工引擎、角色音色与情绪，然后确认生成。`;}
 catch(error){if(id===epoch){status.textContent=controller.signal.aborted?'已取消分析':error.message;if(!controller.signal.aborted)await showAnalysisFailureDiagnostic(workspace,error,scope,()=>id===epoch);}}
 finally{clearInterval(progressTimer);if(id===epoch){analysisController=null;button.disabled=false;workspace.querySelector('[data-cancel-analysis]').disabled=true;}}
}

function resolveDefaultEngineForCharacter(profileId, charGender) {
 const pool = settings.enginePool || { sherpa: true, gemini: true, builtin: true };
 const preset = ENGINE_PRESETS[settings.enginePreset] || ENGINE_PRESETS.golden;
 if (profileId === 'narrator') {
  if (pool.sherpa) return 'sherpa';
  if (pool.builtin) return 'builtin';
  if (pool.gemini) return 'gemini';
 } else {
  if (preset.dialogueEngine && pool[preset.dialogueEngine]) return preset.dialogueEngine;
  if (pool.gemini) return 'gemini';
  if (pool.sherpa) return 'sherpa';
  if (pool.builtin) return 'builtin';
 }
 return Object.keys(pool).find(k => pool[k]) || 'gemini';
}

function getVoicesForEngine(engineId) {
 if (engineId === 'gemini') return engineVoices.gemini;
 if (engineId === 'sherpa') return engineVoices.sherpa.length ? engineVoices.sherpa : [{ name: 'speaker-0', label: 'speaker-0 (默认女声)', gender: 'female' }];
 if (engineId === 'builtin') return engineVoices.builtin.length ? engineVoices.builtin : [{ name: 'default', label: '系统默认音色', gender: 'unknown' }];
 if (engineId === 'other_local') return engineVoices.other_local;
 return [{ name: 'default', label: '默认音色', gender: 'unknown' }];
}

export function renderReview(result,record=activeSession){
 const host=workspace.querySelector('[data-review]'),playback=workspace.querySelector('[data-api-playback]');
 host.hidden=false;host.replaceChildren();playback.replaceChildren();playback.hidden=false;
 const header=document.createElement('p');host.append(header);
 const reviewTools=mountSpeechReviewTools(host,result,()=>{scheduleDraft();refreshCount();},()=>!!generationController||!!analysisController,{scope:activeScope,voiceMap:activeSession?.voices,onRebuild:()=>renderReview(result,activeSession),getLocalRecord:async()=>{await persistDraft();return activeSession;},onReanalyze:reanalyzeSelected,onCancelReanalyze:()=>analysisController?.abort()});
 const profiles=new Map((result.speakers||[]).filter(p=>!p.mergedInto).map(item=>[item.id,item]));
 profiles.set('narrator',profiles.get('narrator')||{id:'narrator',name:'旁白',summary:'',voiceSuggestion:'Kore'});
 for(const segment of result.segments)if(!profiles.has(segment.speakerId))profiles.set(segment.speakerId,{id:segment.speakerId,name:segment.speakerId,voiceSuggestion:'Kore'});

 const voices={};
 const characterEngines={};
 const enabledEngines=Object.keys(settings.enginePool).filter(k=>settings.enginePool[k]);

 const profileBox=document.createElement('section');
 profileBox.innerHTML='<h4>角色与引擎分工</h4>';

 const edited=()=>{
  clearAudio();scheduleDraft();
  playback.querySelector('[data-play]').disabled=true;
  playback.querySelector('[data-pause]').disabled=true;
  playback.querySelector('[data-play-merged]').disabled=true;
  playback.querySelector('[data-export-merged]').disabled=true;
  playback.querySelector('[data-generate]').textContent='确认并生成全部语音';
  playback.querySelector('[data-generate]').dataset.ready='0';
  refreshCount();
 };

 for(const profile of profiles.values()){
  const memory=voiceMemory.characters.find(item=>item.characterId===profile.id);
  const charGender=classifyCharacterGender(profile);
  const initialCategory=charGender==='male'?'male':charGender==='female'||charGender==='neutral'?'female':'all';

  let currentEngine = record?.characterEngines?.[profile.id] || (memory?.engine && settings.enginePool[memory.engine] ? memory.engine : resolveDefaultEngineForCharacter(profile.id, charGender));
  if(!enabledEngines.includes(currentEngine))currentEngine=enabledEngines[0]||'gemini';
  characterEngines[profile.id]=currentEngine;

  const row=document.createElement('div');row.className='xs-profile';row.dataset.profileId=profile.id;
  row.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b>${escapeHtml(profile.name||profile.id)}</b><span class="xs-engine-tag" data-profile-engine-tag>${escapeHtml(getEngineLabel(currentEngine))}</span></div><small>${escapeHtml(profile.summary||memory?.summary||'')}</small>
  <div class="xs-profile-controls">
   <label style="flex:0 0 140px">分工引擎<select class="text_pole" data-profile-engine="${escapeHtml(profile.id)}">${enabledEngines.map(e=>`<option value="${e}" ${e===currentEngine?'selected':''}>${escapeHtml(ENGINE_DEFS[e]?.name||e)}</option>`).join('')}</select></label>
   <label style="flex:0 0 100px">性别大类<select class="text_pole" data-profile-gender="${escapeHtml(profile.id)}"><option value="female" ${initialCategory==='female'?'selected':''}>女声池</option><option value="male" ${initialCategory==='male'?'selected':''}>男声池</option><option value="all" ${initialCategory==='all'?'selected':''}>全部音色</option></select></label>
   <label style="flex:1 1 180px">选择音色<select class="text_pole" data-profile-voice="${escapeHtml(profile.id)}"></select></label>
   <button type="button" class="menu_button" data-preview-btn="${escapeHtml(profile.id)}" style="flex:0 0 auto;margin-top:auto" title="试听该音色">▶ 试听</button>
  </div><small>${memory?'已沿用记忆；修改后自动更新':'根据角色特征推荐分工与音色，可自由调整'}</small>`;

  const engineSelect=row.querySelector('[data-profile-engine]'),genderSelect=row.querySelector('[data-profile-gender]'),voiceSelect=row.querySelector('[data-profile-voice]'),tagSpan=row.querySelector('[data-profile-engine-tag]'),previewBtn=row.querySelector('[data-preview-btn]');

  function updateVoiceOptionsForProfile(){
   const eng=engineSelect.value;
   const available=getVoicesForEngine(eng);
   const cat=genderSelect.value;
   const savedVoice=record?.voices?.[profile.id]||memory?.voiceId;
   const filtered=available.filter(v=>{
    if(cat==='all'||v.name===savedVoice)return true;
    return cat==='female'?(v.gender==='female'||v.gender==='unknown'):cat==='male'?(v.gender==='male'||v.gender==='unknown'):true;
   });
   voiceSelect.replaceChildren();
   for(const item of filtered.length?filtered:available){
    const opt=document.createElement('option');
    opt.value=item.name;
    opt.textContent=item.label||item.name;
    if(item.name===savedVoice)opt.selected=true;
    voiceSelect.append(opt);
   }
   if(![...voiceSelect.options].some(o=>o.value===voiceSelect.value)&&voiceSelect.options.length){
    voiceSelect.value=voiceSelect.options[0].value;
   }
   voices[profile.id]=voiceSelect.value;
   tagSpan.textContent=getEngineLabel(eng);
  }

  updateVoiceOptionsForProfile();
  {const saved=record?.voices?.[profile.id];voices[profile.id]=saved&&[...voiceSelect.options].some(o=>o.value===saved)?saved:voiceSelect.value;}

  engineSelect.onchange=()=>{
   characterEngines[profile.id]=engineSelect.value;
   updateVoiceOptionsForProfile();
   updateSegmentBadges();
   edited();
  };

  genderSelect.onchange=()=>{
   updateVoiceOptionsForProfile();
   edited();
  };

  voiceSelect.onchange=()=>{
   voices[profile.id]=voiceSelect.value;
   edited();
  };

  // Preview button logic
  previewBtn.onclick=async()=>{
   if(activePreview?.btn===previewBtn){
    activePreview.audio.pause();previewBtn.textContent='▶ 试听';activePreview=null;return;
   }
   if(activePreview){activePreview.audio.pause();activePreview.btn.textContent='▶ 试听';activePreview=null;}
   const targetVoice=voiceSelect.value;
   const targetEngine=engineSelect.value;
   if(!targetVoice)return;
   previewBtn.disabled=true;previewBtn.textContent='⏳ 生成中…';
   try{
    const sample="你好，我是"+(profile.name||"发音人")+"，这是我的试听声音。";
    let previewAudio=new Audio();
    if(targetEngine==='gemini'){
     const res=await mediaRequest("generate-tts",{input:sample,voice:targetVoice});
     const blob=await res.blob();
     previewAudio.src=URL.createObjectURL(blob);
    }else{
     const pkg=getEnginePackage(targetEngine);
     const res=await nativeTts("synthesize",{engine:pkg,voice:targetVoice,rate:1,pitch:1,text:sample,scopeId:activeScope?.id||'preview'});
     previewAudio.src="/api/android/media/system-preview/"+res.key;
    }
    previewBtn.textContent="⏹ 停止";previewBtn.disabled=false;
    activePreview={audio:previewAudio,btn:previewBtn};
    previewAudio.onended=()=>{if(activePreview?.btn===previewBtn){previewBtn.textContent="▶ 试听";activePreview=null;}};
    previewAudio.onerror=()=>{if(activePreview?.btn===previewBtn){previewBtn.textContent="▶ 试听";activePreview=null;}toastr.error("试听音频加载失败");};
    await previewAudio.play();
   }catch(err){
    previewBtn.textContent="▶ 试听";previewBtn.disabled=false;
    if(activePreview?.btn===previewBtn)activePreview=null;
    toastr.error("试听失败："+err.message);
   }
  };

  profileBox.append(row);
 }

 if(activeSession){activeSession.result=result;activeSession.voices=voices;activeSession.characterEngines=characterEngines;}
 host.append(profileBox);

 const typeOptions=[['narration','旁白'],['dialogue','角色台词'],['sfx','音效描述（跳过）'],['bgm','背景音乐描述（跳过）'],['ambience','环境音描述（跳过）']];
 const list=document.createElement('section');list.innerHTML='<h4>整段内容与逐段配音</h4>';

 function updateSegmentBadges(){
  for(const row of list.querySelectorAll('.xs-segment')){
   const speakerId=row.querySelector('[data-speaker]')?.value;
   const badge=row.querySelector('[data-segment-engine-badge]');
   if(badge&&speakerId){
    const eng=characterEngines[speakerId]||'gemini';
    badge.textContent=getEngineLabel(eng);
    badge.style.background=ENGINE_DEFS[eng]?.color||'#455a64';
   }
  }
 }

 result.segments.forEach((segment,index)=>{
  const row=document.createElement('div');row.className='xs-segment';
  const currentEng=characterEngines[segment.speakerId]||'gemini';
  row.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
    <span><b>${index+1}.</b> 原文片段</span>
    <span class="xs-engine-badge" data-segment-engine-badge style="background:${ENGINE_DEFS[currentEng]?.color||'#455a64'}">${escapeHtml(getEngineLabel(currentEng))}</span>
  </div>
  <textarea class="text_pole" readonly aria-label="原文片段">${escapeHtml(segment.text)}</textarea>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <label>类型<select class="text_pole" data-segment-type>${typeOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>
    <label>角色<select class="text_pole" data-speaker>${[...profiles.values()].map(profile=>`<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name||profile.id)}</option>`).join('')}</select></label>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    <label>情绪<input class="text_pole" data-emotion maxlength="60" value="${escapeHtml(segment.emotion||'平静')}"></label>
    <label>强度(0~1)<input class="text_pole" type="number" data-intensity min="0" max="1" step="0.05" value="${segment.intensity??0.8}"></label>
    <label>语气<input class="text_pole" data-style maxlength="200" value="${escapeHtml(segment.style||'自然')}"></label>
  </div>`;

  const type=row.querySelector('[data-segment-type]'),speaker=row.querySelector('[data-speaker]');
  type.value=segment.type;speaker.value=segment.speakerId;
  type.addEventListener('change',()=>{
   segment.type=type.value;
   if(type.value==='narration'){segment.speakerId='narrator';speaker.value='narrator';}
   updateSegmentBadges();
   edited();
  });
  speaker.addEventListener('change',()=>{
   segment.speakerId=speaker.value;
   updateSegmentBadges();
   edited();
  });
  for(const field of ['emotion','style','intensity'])row.querySelector('[data-'+field+']').addEventListener('input',event=>{
   segment[field]=field==='intensity'?Math.max(0,Math.min(1,Number(event.target.value)||0)):event.target.value;
   edited();
  });
  reviewTools.decorate(row,segment,index);
  list.append(row);
 });
 host.append(list);

 const controls=document.createElement('div');controls.className='xs-actions';
 controls.innerHTML='<button class="menu_button" type="button" data-generate>确认并生成全部语音</button><button class="menu_button" type="button" data-play disabled>分段连续播放</button><button class="menu_button" type="button" data-play-merged disabled>整篇播放</button><button class="menu_button" type="button" data-export-merged disabled>导出合并音频</button><button class="menu_button" type="button" data-pause disabled>暂停</button><button class="menu_button" type="button" data-stop disabled>停止</button>';
 playback.append(controls);
 const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.dataset.speechAudio='';playback.append(audio);
 const status=document.createElement('p');status.dataset.ttsStatus='';status.setAttribute('role','status');playback.append(status);

 function refreshCount(){
  const count=result.segments.filter(segment=>['narration','dialogue'].includes(segment.type)).length;
  header.textContent=`分析模型：${result.model}；共 ${result.segments.length} 段，其中 ${count} 段将协同生成语音。音效和背景音仅标注。`;
  const pending=unresolvedSpeechSegments(result).length;
  controls.querySelector('[data-generate]').disabled=count===0||pending>0;
  if(pending)header.textContent+='；'+pending+' 段发言人待确认，需先审核。';
 }
 refreshCount();

 controls.querySelector('[data-generate]').addEventListener('click',()=>void generateSpeech(result,profiles,voices,characterEngines,playback));
 controls.querySelector('[data-play]').addEventListener('click',()=>void playCurrent(playback,audio.paused&&audio.currentTime>0));
 controls.querySelector('[data-play-merged]').addEventListener('click',()=>void playMergedAudio(playback));
 controls.querySelector('[data-export-merged]').addEventListener('click',()=>void exportMergedAudio(playback));
 controls.querySelector('[data-pause]').addEventListener('click',()=>{
  clearTimeout(pauseTimer);
  audio.pause();
  status.textContent=`已暂停第 ${playIndex+1}/${playQueue.length} 段，点击连续播放或整篇播放可继续`;
 });
 controls.querySelector('[data-stop]').addEventListener('click',()=>{
  clearTimeout(pauseTimer);
  generationController?.abort();
  audio.pause();playIndex=0;
  if(playQueue.length){audio.src=playQueue[0];audio.load();}
  status.textContent='已停止播放与生成';
 });

 audio.onended=()=>{
  if(playIndex+1<playQueue.length){
   playIndex++;
   void playCurrent(playback);
  }else{
   playIndex=0;audio.src=playQueue[0];audio.load();
   status.textContent='连续播放完成，可重播已生成语音';
  }
 };
 audio.onplay=()=>{status.textContent=`正在播放第 ${playIndex+1}/${playQueue.length} 段`;};
 audio.onerror=()=>{status.textContent='当前音频无法播放，请检查上游返回格式';};

 applySavedAudio(playback,record);
 reviewTools.refresh();
 refreshCount();
 showReviewPage(true);
}

async function reanalyzeSelected(indices,range){
 if(analysisController||generationController)throw Error('请先停止当前任务');const token=epoch,scope={...activeScope},controller=new AbortController();analysisController=controller;
 try{await persistDraft();if(token!==epoch||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');const saved=await (await mediaRequest('reanalyze',{sessionId:activeSession.id,indices,range,expectedRevision:activeSession.reviewRevision,scopeId:scope.id,analysisRequestId:crypto.randomUUID(),analysisDiagnostics:workspace.querySelector('[data-analysis-diagnostics]').checked},controller.signal)).json();if(token!==epoch)return;activeSession=saved;analysisController=null;renderReview(saved.result,saved);await refreshSessions();workspace.querySelector('[data-analysis-status]').textContent=saved.result.reviewNotice;
 }catch(error){if(token===epoch&&!controller.signal.aborted)await showAnalysisFailureDiagnostic(workspace,error,scope,()=>token===epoch);throw Error(controller.signal.aborted?'局部分析已取消，原记录保留':error.message);}finally{if(token===epoch)analysisController=null;}
}

function applySavedAudio(host,record){
 clearAudio();
 if(!record?.result?.segments)return;
 const segments=record.result.segments.filter(x=>['narration','dialogue'].includes(x.type));
 for(let i=0;i<segments.length;i++){
  const clip=record.audio?.find(x=>x.index===i),segment=segments[i];
  if(!clip||clip.text!==segment.text.trim())break;
  playQueue.push(clip.url);
 }
 const count=playQueue.length;
 for(const field of ['play','pause','stop'])host.querySelector('[data-'+field+']').disabled=!count;
 host.querySelector('[data-play-merged]').disabled=!count;
 host.querySelector('[data-export-merged]').disabled=!count;
 const button=host.querySelector('[data-generate]');
 button.dataset.ready=count===segments.length?'1':'0';
 button.textContent=count===segments.length?'已保存，复用全部语音':'确认并生成 / 继续缺失片段';
 if(count){const audio=host.querySelector('audio');audio.src=playQueue[0];audio.load();}
 host.querySelector('[data-tts-status]').textContent=`已恢复 ${count}/${segments.length} 段连续音频；已完成片段可直接复用与播放。`;
}

async function generateSpeech(result,profiles,voices,characterEngines,host){
 if(generationController||analysisController)return;
 if(unresolvedSpeechSegments(result).length){host.querySelector('[data-tts-status]').textContent='请先审核待确认的发言人，或明确确认按旁白音色朗读。';showReviewPage(true);return;}
 const id=++epoch,controller=new AbortController();generationController=controller;const scope={...activeScope},session=activeSession;
 const segments=result.segments.filter(x=>['narration','dialogue'].includes(x.type));
 const generate=host.querySelector('[data-generate]'),status=host.querySelector('[data-tts-status]'),edits=[...workspace.querySelector('[data-review]').querySelectorAll('select,input,[data-confirm-classification]')];
 edits.forEach(x=>x.disabled=true);generate.disabled=true;host.querySelector('[data-stop]').disabled=false;

 try{
  session.provider='hybrid';
  session.characterEngines=characterEngines;
  session.system={
   engine:installedEngines.sherpa?.package||installedEngines.builtin?.package||'com.k2fsa.sherpa.onnx.tts.engine',
   voice:voices['narrator']||'speaker-0',
   rate:1,pitch:1,contextual:true
  };
  await persistDraft();
  if(id!==epoch||controller.signal.aborted)return;

  for(let index=0;index<segments.length;index++){
   if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   const segment=segments[index];
   const speakerId=segment.speakerId;
   const engine=characterEngines[speakerId]||'gemini';
   let voice=voices[speakerId]||'Kore';
    if(engine!=='gemini'){
     const pool=getVoicesForEngine(engine);
     if(!pool.some(v=>v.name===voice)){
      const wantMale=classifyCharacterGender(profiles.get(speakerId)||{})==='male';
      const pick=pool.find(v=>v.installed!==false&&(wantMale?v.gender==='male':v.gender!=='male'))||pool.find(v=>v.installed!==false)||pool[0];
      voice=pick.name;voices[speakerId]=voice;
     }
    }
   const style=[segment.emotion,segment.style].filter(Boolean).join('；').slice(0,500);

   if(session.audio?.some(x=>x.index===index&&x.text===segment.text.trim()&&x.style===style))continue;

   const profileName=profiles.get(speakerId)?.name||speakerId;
   status.textContent=`正在协同生成第 ${index+1}/${segments.length} 段 · 引擎: ${getEngineLabel(engine)} (角色: ${profileName})…`;

   if(engine==='gemini'){
    await mediaRequest('generate-tts',{input:segment.text,voice,style,sessionId:session.id,segmentIndex:index,scopeId:scope.id,scopeLabel:scope.label},controller.signal);
   }else{
    const targetPkg=getEnginePackage(engine);
    const params=emotionParameters(segment.emotion,segment.style,{rate:1,pitch:1},segment.intensity);
    const textToSend=segment.text;
    segment.system={engine:targetPkg,voice,rate:params.rate,pitch:params.pitch,pauseMs:params.pauseMs};
     await persistDraft();
     if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    const generated=await nativeTts('synthesize',{engine:targetPkg,voice,rate:params.rate,pitch:params.pitch,text:textToSend,scopeId:scope.id});
    if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    await mediaRequest('system-clip',{key:generated.key,sessionId:session.id,segmentIndex:index,scopeId:scope.id});
   }
   const saved=await loadSpeechSession(session.id,scope);session.audio=saved.audio;
   if(id!==epoch)return;
  }

  if(id!==epoch)return;
  applySavedAudio(host,session);
  status.textContent=`全部 ${segments.length} 段已协同生成完成，支持分段或整篇连续播放；退出后可随时恢复。`;

  if(workspace.querySelector('[data-remember]').checked){
   const memories=new Map(voiceMemory.characters.map(x=>[x.characterId,x]));
   for(const profile of profiles.values()){
    if(segments.some(x=>x.speakerId===profile.id)){
     memories.set(profile.id,{
      characterId:profile.id,
      displayName:profile.name||profile.id,
      aliases:profile.aliases||[],
      engine:characterEngines[profile.id]||'gemini',
      voiceId:voices[profile.id],
      summary:profile.summary||''
     });
    }
   }
   voiceMemory=await saveVoiceMemory([...memories.values()],scope);
   if(id===epoch)renderMemory();
  }
  await refreshSessions();
 }catch(error){
  if(id===epoch){
   applySavedAudio(host,session);
   status.textContent=(controller.signal.aborted?'已停止生成':'生成失败：'+error.message)+'；已完成片段已保留。';
  }
 }finally{
  if(id===epoch){
   generationController=null;generate.disabled=false;edits.forEach(x=>x.disabled=false);
   workspace.querySelector('[data-review]').__xsReviewRefresh?.();
  }
 }
}

async function playCurrent(host,resume=false){
 const audio=host.querySelector('audio'),status=host.querySelector('[data-tts-status]');if(!playQueue.length){status.textContent='请先生成语音';return;}
 if(!resume){audio.src=playQueue[playIndex];audio.load();}
 try{await audio.play();status.textContent=`正在连续播放第 ${playIndex+1}/${playQueue.length} 段`;host.querySelector('[data-stop]').disabled=false;}catch(error){status.textContent='语音已保留，请点击播放器的播放键重试：'+error.message;}
}

async function playMergedAudio(host){
 const audio=host.querySelector('audio'),status=host.querySelector('[data-tts-status]');
 if(!activeSession?.id||!activeSession?.audio?.length){status.textContent='尚未生成音频';return;}
 const fullUrl='/api/android/media/session/'+activeSession.id+'/full-audio?scope='+encodeURIComponent(activeScope.id)+'&t='+Date.now();
 if(audio.src!==fullUrl){audio.src=fullUrl;audio.load();}
 try{
  await audio.play();
  status.textContent='正在播放整篇无损合并音频（可直接拖动进度条跳转）。';
  host.querySelector('[data-pause]').disabled=false;
  host.querySelector('[data-stop]').disabled=false;
 }catch(error){status.textContent='请点击播放器播放按键：'+error.message;}
}

function exportMergedAudio(host){
 const status=host.querySelector('[data-tts-status]');
 if(!activeSession?.id||!activeSession?.audio?.length){status.textContent='尚未生成音频';return;}
 const exportUrl='/api/android/media/session/'+activeSession.id+'/full-audio?download=1&scope='+encodeURIComponent(activeScope.id);
 const a=document.createElement('a');a.href=exportUrl;
 a.download=(activeScope.label||'语音')+'_'+activeSession.id.slice(0,8)+'.wav';
 document.body.append(a);a.click();a.remove();
 status.textContent=`已导出整篇音频（共 ${activeSession.audio.length} 个片段合并，包含自然停顿）。`;
}

async function runPromptFromMessage(message,selectedText){
 const data=messageSpeechData(message,selectedText);
 await runImagePromptTask(data.text,data.context,data.label,{label:data.label,excerpt:data.text.slice(0,160)});
}
function runPromptFromLatest(){
 const message=[...document.querySelectorAll('#chat .mes')].reverse().find(item=>item.getAttribute('is_user')!=='true'&&item.getAttribute('is_system')!=='true')||document.querySelector('#chat .mes');
 if(message){
  openImageDialog(messageSpeechData(message));
  return;
 }
 const cardSrc=currentCardImageSource();
 if(cardSrc){
  openImageDialog(cardSrc);
  return;
 }
 toastr.info('当前没有可用的聊天回复或角色卡素材');
}
function runPromptFromSelection(){
 const selection=window.getSelection();
 if(!selection?.rangeCount||selection.isCollapsed){toastr.info('请先在聊天记录中长按或拖拽选中文本');return;}
 const range=selection.getRangeAt(0),element=node=>node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement;
 const start=element(range.startContainer)?.closest('#chat .mes_text');
 if(!start){toastr.info('所选文本不在聊天正文内');return;}
 const text=selection.toString().trim();
 if(!text){toastr.info('所选内容为空');return;}
 openImageDialog(messageSpeechData(start.closest('.mes'),text));
}
async function runImagePromptTask(text,context,sourceLabel,sourceObj){
 const roots=getImageRoots();
 const setAllStatus=msg=>{for(const r of roots){const el=r.querySelector('[data-image-prompt-status]');if(el)el.textContent=msg;}};
 const setCancelDisabled=val=>{for(const r of roots){const el=r.querySelector('[data-prompt-cancel]');if(el)el.disabled=val;}};
 imagePromptController?.abort();
 const controller=new AbortController();imagePromptController=controller;setCancelDisabled(false);
 setAllStatus(`正在根据「${sourceLabel}」由文本模型构思图片提示词…`);
 try{
  const scope=currentSpeechScope();
  const styleHint=imageDialog?.querySelector('[data-image-style-hint]')?.value?.trim()||document.querySelector('#xingzhan-synthesis [data-image-style-hint]')?.value?.trim()||'';
  const res=await generateImagePrompt(text,context,controller.signal,{styleHint,scopeId:scope.id});
  if(controller.signal.aborted)return;
  for(const r of roots){
   const pInput=r.querySelector('[data-image-prompt]');if(pInput){pInput.value=res.prompt;scheduleNpuTokenStatus(r);}
   const rSel=r.querySelector('[data-image-ratio]');if(rSel&&res.aspect_ratio&&[...rSel.options].some(o=>o.value===res.aspect_ratio))rSel.value=res.aspect_ratio;
  }
  lastImageSource=sourceObj;
  setAllStatus(`提示词已生成${res.title?'（'+res.title+'）':''}，推荐比例 ${res.aspect_ratio}。点击“生成图片”即可开始绘制。`);
 }catch(error){
  if(controller.signal.aborted){setAllStatus('已取消生成提示词');}
  else{setAllStatus('生成提示词失败：'+(error.message||error));}
 }finally{
  if(imagePromptController===controller){imagePromptController=null;setCancelDisabled(true);}
 }
}
async function refreshImageHistory(){
 try{
  const scope=currentSpeechScope();const res=await loadImageHistory(scope);
  imageHistory=res.images||[];renderImageHistory(imageHistory);
 }catch(error){console.warn('Load image history failed',error);}
}
function renderImageHistory(list){
 const roots=getImageRoots();
 for(const root of roots){
  const countEl=root.querySelector('[data-image-history-count]');if(countEl)countEl.textContent=list.length;
  const container=root.querySelector('[data-image-history-list]');if(!container)continue;
  container.replaceChildren();
  if(!list.length){container.innerHTML='<p style="font-size:0.85em;opacity:0.75;grid-column:1/-1">当前角色卡暂无生成的图片历史</p>';continue;}
  for(const item of list){
   const card=document.createElement('div');card.className='xs-image-card';
   const timeStr=item.createdAt?new Date(item.createdAt).toLocaleString(undefined,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
   card.innerHTML=`<img src="${escapeHtml(item.url)}" alt="历史图片" loading="lazy" title="点击新窗口查看原图"><div class="xs-image-meta"><span>${escapeHtml(item.ratio||'1:1')} · ${escapeHtml(item.format||'png')}</span><span>${escapeHtml(timeStr)}</span></div>${item.source?.label?'<div style="font-size:0.78em;opacity:0.8">来源：'+escapeHtml(item.source.label)+'</div>':''}<div class="xs-image-prompt-text" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</div><div class="xs-actions"><button type="button" class="menu_button" data-use-prompt>使用提示词</button><button type="button" class="menu_button" data-view-orig>查看</button><button type="button" class="menu_button" data-del-img>删除</button></div>`;
   card.querySelector('img').addEventListener('click',()=>window.open(item.url,'_blank'));
   card.querySelector('[data-view-orig]').addEventListener('click',()=>window.open(item.url,'_blank'));
   card.querySelector('[data-use-prompt]').addEventListener('click',()=>{
    for(const r of roots){
     const promptInput=r.querySelector('[data-image-prompt]'),ratioSelect=r.querySelector('[data-image-ratio]');
     if(promptInput){promptInput.value=item.prompt;scheduleNpuTokenStatus(r);}
     if(ratioSelect&&item.ratio&&[...ratioSelect.options].some(o=>o.value===item.ratio))ratioSelect.value=item.ratio;
     const status=r.querySelector('[data-image-status]');if(status)status.textContent='已载入历史提示词及比例设置';
    }
    lastImageSource=item.source||null;
   });
   card.querySelector('[data-del-img]').addEventListener('click',async()=>{
    if(!confirm('确定删除此张历史图片吗？'))return;
    try{await deleteImageHistory(item.id,currentSpeechScope());await refreshImageHistory();}
    catch(err){toastr.error('删除失败：'+err.message);}
   });
   container.append(card);
  }
 }
}


let queuePollTimer = null;
let lastRenderedFinishedTaskTime = 0;

export async function syncImageQueueUI() {
 try {
  const status = await getImageQueueStatus();
  const roots = getImageRoots();
  const isBusy = !!status.isBusy;
  const active = status.activeTask;
  const queue = Array.isArray(status.queue) ? status.queue : [];
  const lastFinished = status.lastFinishedTask;

  for (const r of roots) {
   const qPanel = r.querySelector('[data-image-queue-panel]');
   if (!qPanel) continue;

   if (isBusy || queue.length > 0) {
    qPanel.style.display = 'block';

    const actBox = qPanel.querySelector('[data-image-queue-active]');
    if (actBox) {
     if (active) {
      actBox.style.display = 'block';
      const promptEl = actBox.querySelector('[data-image-queue-prompt]');
      if (promptEl) promptEl.textContent = `[${active.source==='npu'?'本机 NPU':active.source==='local'?'本地 SD':active.source==='localdream'?'Local Dream':'云端'}] ${active.prompt} (${active.ratio})`;
      const elapsedEl = actBox.querySelector('[data-image-queue-elapsed]');
      if (elapsedEl) elapsedEl.textContent = `已耗时: ${active.elapsedSeconds || 0}s`;
     } else {
      actBox.style.display = 'none';
     }
    }

    const pendBox = qPanel.querySelector('[data-image-queue-pending]');
    if (pendBox) {
     if (queue.length > 0) {
      pendBox.style.display = 'block';
      const countEl = pendBox.querySelector('[data-image-queue-count]');
      if (countEl) countEl.textContent = queue.length;
      const listEl = pendBox.querySelector('[data-image-queue-list]');
      if (listEl) {
       listEl.innerHTML = queue.map(item => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 6px;background:rgba(255,255,255,0.06);border-radius:4px;gap:6px;">
         <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">#${item.position} [${item.source==='local'?'本地':'云端'}] ${escapeHtml(item.prompt.slice(0,30))}... (${item.ratio})</span>
         <button type="button" class="menu_button xs-mini-btn" data-cancel-queued-id="${item.id}" style="color:#ff8a80!important;padding:1px 6px;margin:0;">取消</button>
        </div>
       `).join('');
       listEl.querySelectorAll('[data-cancel-queued-id]').forEach(btn => {
        btn.onclick = async (e) => {
         e.preventDefault();
         await cancelImageTask(btn.getAttribute('data-cancel-queued-id'));
         await syncImageQueueUI();
        };
       });
      }
     } else {
      pendBox.style.display = 'none';
     }
    }

    const genBtn = r.querySelector('[data-image-generate]');
    if (genBtn) genBtn.textContent = '🎨 加入生成队列';
    const stopBtn = r.querySelector('[data-image-stop]');
    if (stopBtn) {
     stopBtn.disabled = false;
     stopBtn.textContent = '⏹️ 强行停止生图';
    }
   } else {
    qPanel.style.display = 'none';
    const genBtn = r.querySelector('[data-image-generate]');
    if (genBtn) genBtn.textContent = '🎨 生成图片';
    const stopBtn = r.querySelector('[data-image-stop]');
    if (stopBtn) {
     stopBtn.disabled = true;
     stopBtn.textContent = '⏹️ 强行停止生图';
    }

    if (lastFinished && lastFinished.status === 'completed' && lastFinished.finishedAt > lastRenderedFinishedTaskTime) {
     lastRenderedFinishedTaskTime = lastFinished.finishedAt;
     if (lastFinished.data && lastFinished.format) {
      const url = await saveBase64AsFile(lastFinished.data, 'xingzhan-synthesis', 'image-' + Date.now(), lastFinished.format).catch(() => null);
      if (url) {
       const preview = r.querySelector('[data-image-preview]');
       if (preview) { preview.src = url; preview.hidden = false; }
       const link = r.querySelector('[data-image-link]');
       if (link) { link.href = url; link.hidden = false; }
      }
     }
     const st = r.querySelector('[data-image-status]');
     if (st) st.textContent = '已自动获取后台完成的生图！';
     refreshImageHistory().catch(() => {});
    }
   }
  }

  if (isBusy || queue.length > 0) {
   if (!queuePollTimer) {
    queuePollTimer = setInterval(() => {
     syncImageQueueUI().catch(() => {});
    }, 2000);
   }
  } else {
   if (queuePollTimer) {
    clearInterval(queuePollTimer);
    queuePollTimer = null;
   }
  }
 } catch (err) {
  console.error('[ImageQueue] Sync failed:', err);
 }
}

function startQueuePolling() {
 if (!queuePollTimer) {
  queuePollTimer = setInterval(() => {
   syncImageQueueUI().catch(() => {});
  }, 2000);
 }
 syncImageQueueUI().catch(() => {});
}

export async function stopImageGeneration() {
 const roots = getImageRoots();
 for (const r of roots) {
  const stopBtn = r.querySelector('[data-image-stop]');
  if (stopBtn) {
   stopBtn.disabled = true;
   stopBtn.textContent = '⏹️ 正在强行终止...';
  }
  const st = r.querySelector('[data-image-status]');
  if (st) st.textContent = '正在发送中断信号，强行终止生图进程并释放手机资源...';
 }
 imageEpoch++;
 try {
  await cancelImageTask('all');
  const cfg=await mediaRequest('config/image').then(r=>r.json());
  if(cfg.source==='npu')await mediaRequest('npu/stop',{}).catch(()=>{});
  else if(cfg.source==='local')await mediaRequest('local-engine/stop',{}).catch(()=>{});
 } catch {}
 for (const r of roots) {
  const genBtn = r.querySelector('[data-image-generate]');
  if (genBtn) {
   genBtn.disabled = false;
   genBtn.textContent = '🎨 生成图片';
  }
  const stopBtn = r.querySelector('[data-image-stop]');
  if (stopBtn) {
   stopBtn.disabled = true;
   stopBtn.textContent = '⏹️ 强行停止生图';
  }
  const st = r.querySelector('[data-image-status]');
  if (st) {
   st.textContent = '⏹️ 已强行停止当前生图，后台推理进程已杀死，手机算力已释放。';
   st.style.color = '#ff9800';
  }
 }
 if (window.toastr?.warning) window.toastr.warning('已强行终止生图任务并释放手机资源');
 syncImageQueueUI().catch(() => {});
}

export async function generateImage(prompt,ratio){
 const roots=getImageRoots();
 const activeRoot=(imageDialog&&imageDialog.open)?imageDialog:(roots[0]||document);
 prompt=String(prompt!=null?prompt:(activeRoot.querySelector('[data-image-prompt]')?.value||'')).trim();
 ratio=ratio!=null?ratio:(activeRoot.querySelector('[data-image-ratio]')?.value||'1:1');
 const setAllStatus=msg=>{for(const r of roots){const el=r.querySelector('[data-image-status]');if(el)el.textContent=msg;}};
 if(!prompt){setAllStatus('请先填写图片描述');return;}
 const current=++imageEpoch;
 setAllStatus('正在提交生图任务…');
 for(const r of roots){
  const genBtn=r.querySelector('[data-image-generate]');if(genBtn)genBtn.textContent='⏳ 正在生成...';
  const stopBtn=r.querySelector('[data-image-stop]');if(stopBtn){stopBtn.disabled=false;stopBtn.textContent='⏹️ 强行停止生图';}
 }
 startQueuePolling();
 try{
  const cfg=await mediaRequest('config/image').then(r=>r.json());
  if(cfg.source==='npu'){
   const tokens=await tokenizeNpuImagePrompt(prompt);
   if(tokens.positive.count>tokens.positive.maxLength)throw Error('正面提示词 '+tokens.positive.count+'/'+tokens.positive.maxLength+' token，已超限；请先编辑提示词');
   if(tokens.negative.count>tokens.negative.maxLength)throw Error('负面提示词 '+tokens.negative.count+'/'+tokens.negative.maxLength+' token，已超限；请在生图设置中编辑');
  }
  const scope=activeScope||currentSpeechScope(),extra={scopeId:scope.id,scopeLabel:scope.label,source:lastImageSource};
  const result=await relayImage(prompt,ratio,null,extra);
  if(current!==imageEpoch)return;
  const url=await saveBase64AsFile(result.data,'xingzhan-synthesis','image-'+Date.now(),result.format);
  if(current!==imageEpoch)return;
  for(const r of roots){
   const preview=r.querySelector('[data-image-preview]');if(preview){preview.src=url;preview.hidden=false;}
   const link=r.querySelector('[data-image-link]');if(link){link.href=url;link.hidden=false;}
  }
  setAllStatus('生成成功，图片已保存到酒馆'+(result.historyError?'（'+result.historyError+'）':'与当前角色卡历史'));
  refreshImageHistory().catch(()=>{});
  syncImageQueueUI().catch(()=>{});
  return url;
 }catch(error){
  setAllStatus(error.message);
  syncImageQueueUI().catch(()=>{});
 }finally{
  if(current===imageEpoch){
   for(const r of roots){
    const genBtn=r.querySelector('[data-image-generate]');if(genBtn)genBtn.textContent='🎨 生成图片';
    const stopBtn=r.querySelector('[data-image-stop]');if(stopBtn){stopBtn.disabled=true;stopBtn.textContent='⏹️ 强行停止生图';}
   }
  }
 }
}
