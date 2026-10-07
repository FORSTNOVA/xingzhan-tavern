import {getRequestHeaders} from '/script.js';
import {getContext} from '/scripts/st-context.js';

export async function mediaRequest(route,body,signal){
 const response=await fetch('/api/android/media/'+route,{method:body?'POST':'GET',headers:getRequestHeaders(),body:body?JSON.stringify(body):undefined,signal});
 if(!response.ok){let message='请求失败 HTTP '+response.status;let detail;try{detail=await response.json();message=detail.error||message;if(detail.diagnosticsSaved===false)message+='；诊断日志保存失败，请保留当前错误提示';}catch{}const error=Error(message);error.diagnosticId=detail?.diagnosticId;error.coverageDetails=detail?.coverageDetails;error.diagnosticsSaved=detail?.diagnosticsSaved;throw error;}return response;
}
export async function showAnalysisFailureDiagnostic(workspace,error,scope,isCurrent=()=>true){
 const output=workspace.querySelector('[data-analysis-log-output]');if(!output||!error.diagnosticId)return;
 try{const data=await (await mediaRequest('analysis-diagnostics?scope='+encodeURIComponent(scope.id))).json();if(!isCurrent())return;const record=data.records.find(x=>x.id===error.diagnosticId);output.textContent=record?'本次失败记录（'+record.id+'）\n'+JSON.stringify(record,null,2):'本次诊断记录未找到；不会展示其他请求的旧日志。';output.closest('details').open=true;}
 catch(logError){if(isCurrent()){output.textContent='读取本次诊断失败：'+logError.message;output.closest('details').open=true;}}
}
export function form(kind){
 if(kind==='analysis'){
  return `<div class="xingzhan-media-settings" data-kind="analysis">
 <p>文本与情绪分析模型设置。支持通过官方 Google AI Studio / Vertex AI 直连，或通过 OpenAI 兼容中转接入。修改后点击保存。</p>
 <label>接入来源</label>
 <select data-field="source" class="text_pole">
  <option value="relay">中转服务（New API / One API / OpenAI 格式）</option>
  <option value="makersuite">Google AI Studio 官方直连（Gemini API）</option>
  <option value="vertexai">Google Cloud Vertex AI 官方直连</option>
 </select>

 <div data-group="global-key" style="margin: 8px 0;">
  <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
   <input type="checkbox" data-field="useGlobalKey" style="margin:0;">
   <span>复用酒馆全局配置的 Google 密钥/凭据</span>
  </label>
  <small data-global-status style="display:block;margin-top:4px;font-size:12px;"></small>
 </div>

 <div data-group="relay">
  <label>中转基础地址</label>
  <input data-field="base" class="text_pole" placeholder="https://你的中转域名">
 </div>

 <div data-group="vertex">
  <label>Vertex AI 验证模式</label>
  <select data-field="vertexAuthMode" class="text_pole">
   <option value="express">快速模式（API Key / Express）</option>
   <option value="full">服务账号（Service Account JSON 签名换 Token）</option>
  </select>

  <label>区域 (Region)</label>
  <input data-field="vertexRegion" class="text_pole" placeholder="us-central1 (或 global, asia-east1 等)">

  <div data-subgroup="vertex-project">
   <label>GCP 项目 ID (可选，服务账号模式自动提取)</label>
   <input data-field="vertexProjectId" class="text_pole" placeholder="例如 my-gcp-project-123">
  </div>

  <div data-subgroup="vertex-sa">
   <label>专属 Service Account JSON（留空则复用全局）</label>
   <textarea data-field="serviceAccountJson" class="text_pole" rows="3" placeholder="粘贴 GCP 服务账号 JSON 文本"></textarea>
  </div>
 </div>

 <label>文本分析模型（选择支持结构化 JSON 的 Gemini 或中转模型）</label>
 <div style="display:flex;gap:6px;">
  <input data-model-filter class="text_pole" placeholder="搜索模型" style="flex:1;">
  <button type="button" data-action="models" class="menu_button">刷新模型列表</button>
 </div>
 <select data-field="model" class="text_pole" aria-label="文本分析模型" style="margin-top:6px;"></select>

 <div data-group="custom-key">
  <label data-key-label>令牌 / API Key（输入新凭据覆盖全局或留空保留）</label>
  <input data-field="key" class="text_pole" type="password" autocomplete="new-password" placeholder="输入新令牌，留空保留">
 </div>

 <div class="flex-container" style="margin-top:12px;">
  <button type="button" data-action="save" class="menu_button">保存配置</button>
  <button type="button" data-action="delete" class="menu_button">清除专属凭据</button>
  <button type="button" data-action="check" class="menu_button">检查连接与模型</button>
 </div>
 <p data-status role="status" style="margin-top:8px;font-weight:bold;"></p>
</div>`;
 }

 if(kind==='image'){
  return `<div class="xingzhan-media-settings" data-kind="image">
 <p>生图设置支持 Gemini 中转、酒馆内置 SD.cpp，以及集成 Local Dream 核心的骁龙 NPU 模型。</p>
 <label>接入来源</label>
 <select data-field="source" class="text_pole">
  <option value="relay">中转服务（Google Gemini / 云端生图）</option>
  <option value="local">本地引擎（SD.cpp / 伴侣服务 / SD WebUI）</option>
  <option value="npu">本机 NPU（由酒馆管理）</option>
  <option value="localdream">外部 Local Dream API（需单独打开应用）</option>
 </select>

 <div data-group="image-relay">
  <label>中转基础地址</label><input data-field="base" class="text_pole" placeholder="https://你的中转域名">
  <label>渠道记录（实际路由由中转决定）</label><select data-field="channel" class="text_pole"><option>AI Studio</option><option>Vertex AI</option></select>
  <label>对外模型名称</label><input data-field="model" class="text_pole" placeholder="gemini-3.1-flash-lite-image">
  <label>中转令牌</label><input data-field="key" class="text_pole" type="password" autocomplete="new-password" placeholder="输入新令牌，留空保留">
  <label>清晰度</label><select data-field="resolution" class="text_pole"><option>1K</option><option>2K</option><option>4K</option></select>
 </div>

 <div data-group="image-local">
  <div style="margin:4px 0 10px 0;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:6px;border:1px solid rgba(255,255,255,0.12);">
   <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
    <label style="font-weight:bold;margin:0;">生图模型 (离线 SD / GGUF / SafeTensors)</label>
    <button type="button" data-local-model-refresh class="menu_button xs-mini-btn" style="margin:0;padding:2px 8px;font-size:0.82em;">🔄 刷新模型</button>
   </div>
   <select data-field="selectedModel" class="text_pole" style="font-size:0.95em;padding:6px 8px;margin:0;">
    <option value="">正在检测本地模型...</option>
   </select>
   <small style="opacity:0.75;display:block;margin-top:4px;">已支持扫描 tools/local-sd 与手机 Download 目录中的 .safetensors / .gguf 模型</small>
  </div>
  <label>本地推理后端</label><select data-field="localBackend" class="text_pole"><option value="cpu">CPU（稳定模式）</option><option value="opencl">GPU（Adreno OpenCL，实验性）</option></select>
  <small style="opacity:0.75;display:block;margin-top:-4px;">GPU 使用手机的 Adreno OpenCL 驱动，仍处于实机验证阶段；若生成失败，请切回 CPU。切换后点“保存配置”生效。</small>
  <label>本地引擎服务地址 (sd.cpp / WebUI 伴侣)</label><input data-field="localUrl" class="text_pole" placeholder="http://127.0.0.1:8789">
  <label>采样步数 (标准 SD 推荐 15~20 步，LCM/Turbo 模型推荐 4~8 步)</label><input data-field="steps" class="text_pole" type="number" min="4" max="50" placeholder="15">
  <label>CFG 引导系数 (标准 SD 推荐 7.0，LCM 微调推荐 1.8)</label><input data-field="cfgScale" class="text_pole" type="number" step="0.1" min="1" max="15" placeholder="7.0">
  <label>通用负面提示词 (Negative Prompt)</label><textarea data-field="negativePrompt" class="text_pole" rows="2" placeholder="bad anatomy, bad hands, lowres, text, watermark, deformed, blurry"></textarea>
  <div class="local-engine-panel" style="margin:8px 0;padding:10px;background:rgba(0,0,0,0.25);border-radius:8px;border:1px solid rgba(255,255,255,0.12);">
   <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <span style="font-weight:bold;font-size:0.95em;">本地 SD 引擎伴侣管理</span>
    <span data-local-engine-badge style="font-size:0.82em;padding:2px 8px;border-radius:10px;background:#555;color:#fff;">⚪ 检测中...</span>
   </div>
   <div class="flex-container" style="gap:6px;margin-bottom:8px;">
    <button type="button" data-local-engine-btn="start" class="menu_button" style="flex:1;">▶ 启动本地引擎</button>
    <button type="button" data-local-engine-btn="stop" class="menu_button" style="flex:1;">⏹ 停止本地引擎</button>
    <button type="button" data-local-engine-btn="refresh" class="menu_button">🔄 刷新</button>
   </div>
   <div data-local-engine-info style="font-size:0.82em;line-height:1.5;margin-bottom:6px;opacity:0.9;"></div>
   <details data-local-engine-details style="margin-top:6px;font-size:0.82em;">
    <summary style="cursor:pointer;opacity:0.8;">查看引擎运行日志</summary>
    <pre data-local-engine-logs style="max-height:120px;overflow-y:auto;background:#111;color:#a5d6a7;padding:6px;border-radius:4px;margin-top:4px;white-space:pre-wrap;font-family:monospace;font-size:11px;">暂无日志</pre>
   </details>
  </div>
  <p style="font-size:0.85em;opacity:0.8;margin:4px 0;">说明：本地引擎运行在手机本地，无审核拦截、无需联网令牌。推荐搭配 <b>GhostMix-LCM</b> 或 <b>DreamShaper-8-LCM</b> GGUF 量化模型。</p><p style="font-size:0.85em;color:#ff9800;margin:4px 0;">⚠️ 提示：点击上方「▶ 启动本地引擎」可直接唤起本地后台伴侣；若未放置本地模型，请在上方切回「中转服务（云端生图）」即可直接出图。</p>
 </div>

 <div data-group="image-npu" class="xs-npu-panel" hidden>
  <div class="xs-npu-heading"><strong>本机 NPU 生图</strong><span data-npu-badge data-state="checking">检测中</span></div>
  <p class="xs-npu-hint">导入兼容的 QNN SD 1.5 模型 ZIP，选择模型后启动。生成时使用手机 NPU；停止可释放模型占用的内存。</p>
  <details class="xs-npu-card" data-npu-import-details>
   <summary>① 导入模型 ZIP</summary>
   <div class="xs-npu-card-body">
    <div class="xs-npu-file-row"><button type="button" data-npu-file-trigger class="menu_button">选择 ZIP 文件</button><span data-npu-file-name>尚未选择文件</span></div>
    <input data-npu-file type="file" accept=".zip,application/zip,application/x-zip-compressed" style="display:none;">
    <button type="button" data-npu-import class="menu_button">导入所选模型</button>
    <div data-npu-progress-wrap class="xs-npu-progress" hidden><progress data-npu-progress max="100" value="0"></progress><small data-npu-progress-text>准备导入…</small></div>
    <small>模型保存在本应用目录。导入大文件时请保持酒馆在前台。</small>
   </div>
  </details>
  <div class="xs-npu-card">
   <strong>② 选择并启动</strong>
   <label>已导入的模型</label><select data-npu-model class="text_pole" aria-label="已导入的 NPU 模型"><option value="">正在读取模型…</option></select>
   <div class="xs-npu-actions">
    <button type="button" data-npu-action="start" class="menu_button">▶ 启动所选模型</button>
    <button type="button" data-npu-action="stop" class="menu_button">⏹ 停止并释放</button>
    <button type="button" data-npu-action="refresh" class="menu_button">刷新状态</button>
   </div>
   <div data-npu-status class="xs-npu-status" role="status">正在检查运行环境…</div>
   <p data-npu-notice class="xs-npu-notice" role="status" hidden></p>
   <details><summary>查看 NPU 运行日志</summary><pre data-npu-logs>暂无运行日志</pre></details>
  </div>
  <details class="xs-npu-card" data-npu-params-details>
   <summary>③ 生成参数</summary>
   <div class="xs-npu-card-body">
    <label>采样步数</label><input data-field="steps" class="text_pole" type="number" min="1" max="60" placeholder="20">
   <label>CFG 引导系数</label><input data-field="cfgScale" class="text_pole" type="number" step="0.1" min="0.5" max="20" placeholder="7.5">
   <label>负面提示词</label><textarea data-field="negativePrompt" class="text_pole" rows="2"></textarea>
    <button type="button" data-npu-standard-preset class="menu_button">应用普通 SD 1.5 画质预设：20 步 / CFG 7</button>
    <small>4–8 步、低 CFG 仅适合明确标注 Turbo/LCM 的模型。普通 AnythingV5 建议从 20 步 / CFG 7 开始；非方形输出会自动加载模型包内的分辨率补丁。</small>
   </div>
  </details>
 </div>

 <div data-group="image-localdream" hidden>
  <p>通过 Local Dream 的本机 HTTP API 调用已加载的 QNN/HTP 模型。请先打开 Local Dream 并加载 NPU 模型。部分系统会隔离不同应用间的 127.0.0.1 访问；若诊断超时，即使 ADB 转发可访问，也需要系统允许酒馆访问该端口或使用本机代理。</p>
  <label>Local Dream API 地址</label><input data-field="localDreamUrl" class="text_pole" placeholder="http://127.0.0.1:8081">
  <small style="opacity:0.75;display:block;margin:4px 0 10px;">此路线不使用酒馆内的 SD.cpp 模型与 CPU/GPU 开关。SD 1.5 提示词上限为 77 tokens；当前按模型支持的方形或横竖版尺寸提交。</small>
 </div>

 <div class="flex-container" style="margin-top:12px;">
  <button type="button" data-action="save" class="menu_button">保存配置</button>
  <button type="button" data-action="delete" class="menu_button">删除令牌</button>
  <button type="button" data-action="check" class="menu_button">检查连接与引擎状态</button>
 </div>
 <p data-status role="status" style="margin-top:8px;font-weight:bold;"></p>
</div>`;
 }

 return `<div class="xingzhan-media-settings" data-kind="${kind}">
 <p>通过 New API 转接。修改后点击保存；令牌留空表示保留。</p>
 <label>中转基础地址</label><input data-field="base" class="text_pole" placeholder="https://你的中转域名">
 <label>渠道记录（实际路由由中转决定）</label><select data-field="channel" class="text_pole"><option>AI Studio</option></select>
 <label>对外模型名称</label>
 <input data-field="model" class="text_pole">
 <label>中转令牌</label><input data-field="key" class="text_pole" type="password" autocomplete="new-password" placeholder="输入新令牌，留空保留">
 <label>默认音色 ID</label><input data-field="voice" class="text_pole"><label>朗读风格（可选）</label><textarea data-field="style" class="text_pole" placeholder="自然、温柔地朗读"></textarea>
 <div class="flex-container"><button type="button" data-action="save" class="menu_button">保存配置</button><button type="button" data-action="delete" class="menu_button">删除令牌</button><button type="button" data-action="check" class="menu_button">检查连接与模型</button></div><p data-status role="status"></p></div>`;
}

export async function mount(container,kind,onSaved=()=>{}){
 const status=container.querySelector('[data-status]'),model=container.querySelector('[data-field="model"]');let models=[],chosen='';
 const globalStatus=container.querySelector('[data-global-status]');
 const sourceSelect=container.querySelector('[data-field="source"]');
 const useGlobalKeyBox=container.querySelector('[data-field="useGlobalKey"]');
 const vertexAuthModeSelect=container.querySelector('[data-field="vertexAuthMode"]');
 let lastConfig={};

 const updateVisibility=()=>{
  if(kind==='image'){
   const src=sourceSelect?.value||'relay';
   container.querySelector('[data-group="image-relay"]')?.toggleAttribute('hidden',src!=='relay');
   container.querySelector('[data-group="image-local"]')?.toggleAttribute('hidden',src!=='local');
   container.querySelector('[data-group="image-localdream"]')?.toggleAttribute('hidden',src!=='localdream');
   container.querySelector('[data-group="image-npu"]')?.toggleAttribute('hidden',src!=='npu');
   container.querySelector('[data-action="delete"]')?.toggleAttribute('hidden',src!=='relay');
   return;
  }
  if(kind!=='analysis')return;
  const src=sourceSelect?.value||'relay';
  const isVertex=src==='vertexai';
  const isMakersuite=src==='makersuite';
  const isRelay=src==='relay';
  const mode=vertexAuthModeSelect?.value||'express';

  container.querySelector('[data-group="relay"]')?.toggleAttribute('hidden',!isRelay);
  container.querySelector('[data-group="global-key"]')?.toggleAttribute('hidden',isRelay);
  container.querySelector('[data-group="vertex"]')?.toggleAttribute('hidden',!isVertex);
  container.querySelector('[data-subgroup="vertex-sa"]')?.toggleAttribute('hidden',!isVertex||mode!=='full');
  container.querySelector('[data-subgroup="vertex-project"]')?.toggleAttribute('hidden',!isVertex||mode==='full');

  const keyGroup=container.querySelector('[data-group="custom-key"]');
  if(keyGroup){
   keyGroup.toggleAttribute('hidden',isVertex&&mode==='full');
   const keyLabel=container.querySelector('[data-key-label]');
   if(keyLabel){
    keyLabel.textContent=isMakersuite?'Google AI Studio API Key（专属覆盖）':isVertex?'Vertex AI API Key（专属覆盖）':'中转令牌（留空保留）';
   }
  }

  if(globalStatus&&lastConfig.globalAvailable){
   if(isMakersuite){
    const avail=lastConfig.globalAvailable.makersuite;
    globalStatus.textContent=avail?'✓ 检测到酒馆全局已配置 Google AI Studio Key':'✗ 酒馆主设置尚未填入 Google AI Studio Key（若不使用专属 Key 则需填入）';
    globalStatus.style.color=avail?'#4caf50':'#ff9800';
   }else if(isVertex){
    const avail=mode==='full'?lastConfig.globalAvailable.vertexFull:lastConfig.globalAvailable.vertexExpress;
    globalStatus.textContent=avail?'✓ 检测到酒馆全局已配置对应 Vertex AI 凭据':'✗ 酒馆主设置尚未填入对应 Vertex 凭据（若不使用专属凭据则需填入）';
    globalStatus.style.color=avail?'#4caf50':'#ff9800';
   }else{
    globalStatus.textContent='';
   }
  }
 };

 const renderModels=()=>{
  const filter=container.querySelector('[data-model-filter]')?.value.toLowerCase()||'';
  const ids=models.filter(id=>id.toLowerCase().includes(filter));
  model.replaceChildren();
  if(chosen&&!ids.includes(chosen))model.add(new Option(chosen+'（当前）',chosen));
  for(const id of ids)model.add(new Option(id,id));
  model.value=chosen;
 };

 const refresh=async()=>{
  const data=await(await mediaRequest('models/'+kind)).json();
  models=data.models||[];
  chosen=model.value||chosen;
  renderModels();
  status.textContent='已拉取 '+models.length+' 个模型；选择后点击保存。';
 };

 const show=config=>{
  lastConfig=config;
  for(const input of container.querySelectorAll('[data-field]')){
   if(input.dataset.field==='key'||input.dataset.field==='serviceAccountJson')continue;
   if(input.type==='checkbox')input.checked=config[input.dataset.field]!==false;
   else if(kind==='analysis'&&input===model){chosen=config.model;renderModels();}
   else if(input.tagName==='SELECT')input.value=config[input.dataset.field]||(input.options[0]?.value||'');
   else input.value=config[input.dataset.field]||'';
  }
  updateVisibility();
  let keyStatus='';
  if(kind==='analysis'){
   if(config.source==='makersuite')keyStatus=config.hasGlobalKey&&config.useGlobalKey?'已复用酒馆全局 AI Studio Key':config.hasCustomKey?'已配置专属 AI Studio Key':config.hasKey?'已就绪':'尚未配置 API Key';
   else if(config.source==='vertexai')keyStatus=config.hasGlobalKey&&config.useGlobalKey?'已复用酒馆全局 Vertex 凭据':config.hasCustomKey?'已配置专属 Vertex 凭据':config.hasKey?'已就绪':'尚未配置凭据';
   else keyStatus=config.hasKey?'已配置中转令牌':'尚未配置令牌';
  }else if(kind==='image'){
   keyStatus=config.source==='npu'?'已选择本机 NPU 模型：'+(config.selectedModel||'尚未选择'):config.source==='localdream'?'已选择 Local Dream 外部 API':config.source==='local'?'已启用本地 SD 引擎 (sd.cpp)':config.hasKey?'已配置中转令牌':'尚未配置令牌';
  }else{
   keyStatus=config.hasKey?'已配置令牌':'尚未配置令牌';
  }
  status.textContent=keyStatus;
  status.style.color='';
  onSaved(config);
  return config;
 };

 try{
  const config=show(await(await mediaRequest('config/'+kind)).json());
 }catch(error){status.textContent=error.message;}

 container.querySelector('[data-model-filter]')?.addEventListener('input',renderModels);
 sourceSelect?.addEventListener('change',updateVisibility);
 useGlobalKeyBox?.addEventListener('change',updateVisibility);
 vertexAuthModeSelect?.addEventListener('change',updateVisibility);

 if(kind==='analysis')model.addEventListener('change',()=>chosen=model.value);

 const updateLocalEngineStatus=async()=>{
   if(kind!=='image')return;
   const badge=container.querySelector('[data-local-engine-badge]');
   const info=container.querySelector('[data-local-engine-info]');
   const logs=container.querySelector('[data-local-engine-logs]');
   if(!badge)return;
   try{
    const res=await(await mediaRequest('local-engine/status')).json();
    if(res.running){
     badge.textContent='🟢 运行中 ('+res.port+')';
     badge.style.background='#2e7d32';
    }else{
     badge.textContent='⚪ 未运行';
     badge.style.background='#555';
    }
    // Update dedicated model selector
    const modelSelect = container.querySelector('[data-field="selectedModel"]');
    if (modelSelect && Array.isArray(res.allModels)) {
     modelSelect.replaceChildren();
     if (res.allModels.length === 0) {
      modelSelect.add(new Option('未检测到本地模型 (请放入 tools/local-sd)', ''));
     } else {
      for (const m of res.allModels) {
       const opt = new Option(m.name + ' (' + m.sizeMb + ' MB · ' + m.dir + ')', m.name);
       if (m.name === (res.selectedModel || res.modelName)) opt.selected = true;
       modelSelect.add(opt);
      }
     }
     if (!modelSelect.dataset.bound) {
      modelSelect.dataset.bound = 'true';
      modelSelect.addEventListener('change', async () => {
       const chosen = modelSelect.value;
       try {
        lastConfig.selectedModel = chosen;
        await mediaRequest('local-engine/model', { model: chosen });
        status.textContent = '已切换生效模型: ' + chosen;
        status.style.color = '#4caf50';
        await updateLocalEngineStatus();
       } catch (e) {
        status.textContent = '切换失败: ' + e.message;
        status.style.color = '#f44336';
       }
      });
     }
    }
    const refreshBtn = container.querySelector('[data-local-model-refresh]');
    if (refreshBtn && !refreshBtn.dataset.bound) {
     refreshBtn.dataset.bound = 'true';
     refreshBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await updateLocalEngineStatus();
     });
    }

    if(info){
     const parts=[];
     parts.push('<b>工作目录:</b> '+res.sdDir);
     if(Array.isArray(res.allModels)&&res.allModels.length>0){
      parts.push('<span style="color:#81c784;">✓ 检测到 '+res.allModels.length+' 个本地模型，当前激活：<b>'+(res.selectedModel||res.modelName)+'</b></span>');
     }else{
      parts.push('<span style="color:#ffb74d;">✗ 未检测到模型 (请将 .gguf / .safetensors 放入 tools/local-sd 或手机 Download 目录)</span>');
     }
     parts.push(res.binFound?'<span style="color:#81c784;">✓ 推理程序已就绪 ('+res.binName+')</span>':'<span style="color:#ffb74d;">✗ 未检测到 sd 程序 (请将 sd 放入 tools/local-sd)</span>');
     info.innerHTML=parts.join('<br>');
    }
    if(logs&&Array.isArray(res.logs)){
     logs.textContent=res.logs.join('\n')||'暂无引擎日志';
    }
   }catch(e){
    badge.textContent='检查失败';
    badge.style.background='#c62828';
   }
  };

  let npuBusy=false,npuLastStatus=null;
  const npuSelect=container.querySelector('[data-npu-model]');
  const npuFileInput=container.querySelector('[data-npu-file]');
  const npuProgressWrap=container.querySelector('[data-npu-progress-wrap]');
  const npuProgress=container.querySelector('[data-npu-progress]');
  const npuProgressText=container.querySelector('[data-npu-progress-text]');
  const npuNotice=container.querySelector('[data-npu-notice]');
  const setNpuNotice=(message,tone='info')=>{if(!npuNotice)return;npuNotice.textContent=message;npuNotice.dataset.tone=tone;npuNotice.hidden=!message;};
  const renderNpuControls=()=>{
   const running=!!npuLastStatus?.running;
   if(npuSelect)npuSelect.disabled=npuBusy||running||!npuLastStatus?.models?.length;
   container.querySelector('[data-npu-file-trigger]').disabled=npuBusy||running;
   container.querySelector('[data-npu-import]').disabled=npuBusy||running;
   container.querySelector('[data-npu-action="start"]').disabled=npuBusy||running||!npuLastStatus?.supported||!npuSelect?.value;
   container.querySelector('[data-npu-action="stop"]').disabled=npuBusy||!running;
   container.querySelector('[data-npu-action="refresh"]').disabled=npuBusy;
  };
  const setNpuBusy=busy=>{npuBusy=busy;container.querySelector('[data-group="image-npu"]')?.setAttribute('aria-busy',String(busy));renderNpuControls();};
  const updateNpuStatus=async()=>{
   if(kind!=='image')return;
   const info=container.querySelector('[data-npu-status]'),badge=container.querySelector('[data-npu-badge]'),logs=container.querySelector('[data-npu-logs]');
   try{
    const res=await(await mediaRequest('npu/status')).json();npuLastStatus=res;
    const importDetails=container.querySelector('[data-npu-import-details]');
    if(importDetails&&!importDetails.dataset.initialized){importDetails.open=!res.models?.length;importDetails.dataset.initialized='true';}
    const names=new Set((res.models||[]).map(item=>item.name));
    const selected=[res.running?res.modelName:'',res.selectedModel,npuSelect.value,lastConfig.selectedModel].find(name=>names.has(name))||res.models?.[0]?.name||'';
    npuSelect.replaceChildren();if(!res.models?.length)npuSelect.add(new Option('尚未导入 QNN 模型',''));
    for(const item of res.models||[])npuSelect.add(new Option(item.name+' · '+Math.round(item.bytes/1048576)+' MB',item.name));
    npuSelect.value=selected;
    const state=res.ready?'ready':res.running?'starting':res.supported?'stopped':'unavailable';
    badge.dataset.state=state;badge.textContent={ready:'运行中',starting:'启动中',stopped:'已停止',unavailable:'不可用'}[state];
    info.textContent=(res.ready?'正在运行：'+res.modelName+' · '+(res.resolution||'512x512')+'。非方形生图会自动加载对应补丁。':res.running?'正在加载 '+res.modelName+'，请稍候。':res.supported?'已导入 '+(res.models?.length||0)+' 个模型；选择并启动后即可生成。':res.socModel?'设备 '+res.socModel+' 的 NPU 运行环境尚未就绪。':'尚未检测到兼容的 NPU 运行环境。')+(res.runtimeReady?'':' QNN 运行库不可用。');
    if(logs)logs.textContent=(res.logs||[]).join('\n')||'暂无运行日志';
   }catch(error){npuLastStatus=null;badge.dataset.state='unavailable';badge.textContent='检查失败';info.textContent='读取 NPU 状态失败：'+error.message;}
   renderNpuControls();
  };

  const uploadNpuArchive=file=>new Promise((resolve,reject)=>{
   const xhr=new XMLHttpRequest();xhr.open('PUT','/api/android/media/npu/models/import');xhr.setRequestHeader('Content-Type','application/zip');xhr.setRequestHeader('X-Model-Name',encodeURIComponent(file.name));
   const headers=getRequestHeaders({omitContentType:true});for(const [name,value] of Object.entries(headers||{}))xhr.setRequestHeader(name,value);
   xhr.timeout=30*60*1000;xhr.upload.onprogress=event=>{if(event.lengthComputable){const percent=Math.round(event.loaded/event.total*100);npuProgress.value=percent;npuProgressText.textContent='上传模型 '+percent+'%';}};
   xhr.upload.onload=()=>{npuProgress.removeAttribute('value');npuProgressText.textContent='上传完成，正在解压并校验模型…';};
   xhr.onerror=()=>reject(Error('模型上传连接失败'));xhr.ontimeout=()=>reject(Error('模型上传超时'));xhr.onload=()=>{let result={};try{result=JSON.parse(xhr.responseText);}catch{}if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Error(result.error||('HTTP '+xhr.status)));};xhr.send(file);
  });

  npuSelect?.addEventListener('change',async event=>{
   const chosen=event.currentTarget.value;if(!chosen)return;
   setNpuBusy(true);setNpuNotice('正在切换到 '+chosen+'…');
   try{await mediaRequest('npu/select',{model:chosen});lastConfig={...lastConfig,source:'npu',selectedModel:chosen};sourceSelect.value='npu';updateVisibility();await updateNpuStatus();onSaved(lastConfig);setNpuNotice('已选择 '+chosen+'；点击“启动所选模型”开始加载。','success');}
   catch(error){setNpuNotice('切换模型失败：'+error.message,'error');await updateNpuStatus();}
   finally{setNpuBusy(false);}
  });
  container.querySelector('[data-npu-file-trigger]')?.addEventListener('click',()=>npuFileInput?.click());
  npuFileInput?.addEventListener('change',()=>{container.querySelector('[data-npu-file-name]').textContent=npuFileInput.files?.[0]?.name||'尚未选择文件';setNpuNotice('');});
  container.querySelector('[data-npu-import]')?.addEventListener('click',async()=>{
   const file=npuFileInput?.files?.[0];if(!file){setNpuNotice('请先选择模型 ZIP 文件。','error');return;}
   if(file.size>1500000000){setNpuNotice('模型 ZIP 超过 1.5GB 上限。','error');return;}
   setNpuBusy(true);npuProgressWrap.hidden=false;npuProgress.value=0;npuProgressText.textContent='准备上传 '+file.name;setNpuNotice('导入过程中请保持酒馆在前台。');
   try{const imported=await uploadNpuArchive(file);await mediaRequest('npu/select',{model:imported.model.name});lastConfig={...lastConfig,source:'npu',selectedModel:imported.model.name};sourceSelect.value='npu';updateVisibility();await updateNpuStatus();onSaved(lastConfig);npuProgress.value=100;npuProgressText.textContent='导入完成';setNpuNotice('模型已导入：'+imported.model.name+'（'+Math.round(imported.model.bytes/1048576)+' MB）。','success');}
   catch(error){npuProgressWrap.hidden=true;setNpuNotice('导入失败：'+error.message,'error');}
   finally{setNpuBusy(false);}
  });
  container.querySelectorAll('[data-npu-action]').forEach(button=>button.addEventListener('click',async()=>{
   const action=button.dataset.npuAction;if(action==='refresh'){await updateNpuStatus();setNpuNotice('运行状态已刷新。','success');return;}
   const chosen=npuSelect?.value;setNpuBusy(true);setNpuNotice(action==='start'?'正在加载 '+chosen+'，首次启动可能需要一两分钟…':'正在停止 NPU 并释放内存…');
   try{
    if(action==='start'){
     if(!chosen)throw Error('请先导入并选择模型');
     await mediaRequest('npu/select',{model:chosen});lastConfig={...lastConfig,source:'npu',selectedModel:chosen};sourceSelect.value='npu';updateVisibility();onSaved(lastConfig);
    }
    await mediaRequest('npu/'+action,action==='start'?{model:chosen}:{});
    await updateNpuStatus();setNpuNotice(action==='start'?'NPU 已就绪，可以生成图片。':'NPU 已停止，模型内存已释放。','success');
   }catch(error){setNpuNotice('NPU 操作失败：'+error.message,'error');await updateNpuStatus();}
   finally{setNpuBusy(false);}
  }));
  if(kind==='image')renderNpuControls();
  container.querySelector('[data-npu-standard-preset]')?.addEventListener('click',()=>{
   container.querySelector('[data-group="image-npu"] [data-field="steps"]').value='20';
   container.querySelector('[data-group="image-npu"] [data-field="cfgScale"]').value='7';
   container.querySelector('[data-action="save"]').click();
  });

  sourceSelect?.addEventListener('change',()=>{if(sourceSelect.value==='local')void updateLocalEngineStatus();});
  sourceSelect?.addEventListener('change',()=>{if(sourceSelect.value==='npu')void updateNpuStatus();});

  container.querySelectorAll('[data-local-engine-btn]').forEach(btn=>{
   btn.addEventListener('click',async()=>{
    const act=btn.dataset.localEngineBtn;
    btn.disabled=true;
    try{
     if(act==='start'){
      await mediaRequest('local-engine/start',{});
      status.textContent='已启动本地 SD 伴侣服务';
      status.style.color='#4caf50';
     }else if(act==='stop'){
      await mediaRequest('local-engine/stop',{});
      status.textContent='已停止本地 SD 伴侣服务';
      status.style.color='#ff9800';
     }
     await updateLocalEngineStatus();
    }catch(err){
     status.textContent='操作失败: '+err.message;
     status.style.color='#f44336';
    }finally{
     btn.disabled=false;
    }
   });
  });
  if(kind==='image'&&(sourceSelect?.value||'relay')==='local')updateLocalEngineStatus();
  if(kind==='image'&&(sourceSelect?.value||'relay')==='npu')updateNpuStatus();

  for(const button of container.querySelectorAll('[data-action]'))button.addEventListener('click',async()=>{
  button.disabled=true;
  try{
   if(button.dataset.action==='models'){await refresh();return;}
   if(button.dataset.action==='check'){
    const info=await(await mediaRequest('diagnostics/'+kind)).json();
    if(info.status===200){
     status.textContent=info.listed?'✓ 连接正常，模型在可用列表中':'✓ 连接正常（共检测到 '+info.modelCount+' 个可用模型）';
     status.style.color='#4caf50';
    }else{
     status.textContent='HTTP '+info.status+'：'+info.error;
     status.style.color='#f44336';
    }
    return;
   }
   const body={};
   for(const input of container.querySelectorAll('[data-field]')){
    if(input.type==='checkbox')body[input.dataset.field]=input.checked;
    else if(input.value)body[input.dataset.field]=input.value;
    else if(input.dataset.field!=='key'&&input.dataset.field!=='serviceAccountJson')body[input.dataset.field]='';
   }
   if(kind==='image'&&body.source==='npu')body.selectedModel=npuSelect?.value||lastConfig.selectedModel||'';
   if(button.dataset.action==='delete'){
    body.removeKey=true;
   }
   const config=await(await mediaRequest('config/'+kind,body)).json();
   const keyInput=container.querySelector('[data-field="key"]');if(keyInput)keyInput.value='';
   const saInput=container.querySelector('[data-field="serviceAccountJson"]');if(saInput)saInput.value='';
   show(config);
   status.textContent='配置已保存';
   status.style.color='#4caf50';
   if(kind==='analysis'&&config.hasKey)await refresh();
  }catch(error){
   status.textContent=error.message;
   status.style.color='#f44336';
  }finally{button.disabled=false;}
 });
}
export class XingzhanTtsProvider{
 settings={voiceMap:{}};voices=[];separator='。';audioElement=document.createElement('audio');
 get settingsHtml(){return form('tts');}
 async loadSettings(settings){this.settings={voiceMap:{},...settings};await this.checkReady();}
 async fetchTtsVoiceObjects(){const config=await(await mediaRequest('config/tts')).json();this.config=config;return [...new Set([config.voice,'Kore','Puck','Aoede','Leda','Zephyr'])].map(voice=>({name:voice,voice_id:voice,lang:'zh-CN'}));}
 async onRefreshClick(){this.voices=await this.fetchTtsVoiceObjects();}
 async checkReady(){this.voices=await this.fetchTtsVoiceObjects();}
 async getVoice(name){if(!this.voices.length)await this.checkReady();const voice=this.voices.find(v=>v.name===name);if(!voice)throw Error('音色不存在，请刷新音色列表');return voice;}
 async generateTts(input,voice){return this.fetchTtsGeneration(input,voice);}
 async fetchTtsGeneration(input,voice,style=''){this.controller?.abort();const controller=new AbortController();this.controller=controller;try{return await mediaRequest('generate-tts',{input,voice,style},controller.signal);}finally{if(this.controller===controller)this.controller=null;}}
 cancel(){this.controller?.abort();this.audioElement.pause();}
 dispose(){this.cancel();if(this.audioElement.src.startsWith('blob:'))URL.revokeObjectURL(this.audioElement.src);}
}
export async function relayImage(prompt,ratio,signal,extra={}){return(await mediaRequest('generate-image',{prompt,aspect_ratio:ratio,...extra},signal)).json();}
export async function tokenizeNpuImagePrompt(prompt){return(await mediaRequest('npu/tokenize',{prompt})).json();}
export async function getImageQueueStatus(){return(await mediaRequest('image-queue/status')).json();}
export async function cancelImageTask(taskId='all'){return(await mediaRequest('image-queue/cancel',{id:taskId})).json();}
export async function generateImagePrompt(text,context=[],signal,extra={}){return(await mediaRequest('image-prompt',{text,context,...extra},signal)).json();}
export async function loadImageHistory(scope=currentSpeechScope()){return(await mediaRequest('image-history?scope='+encodeURIComponent(scope.id||scope))).json();}
export async function deleteImageHistory(id,scope=currentSpeechScope()){return(await mediaRequest('image-history/delete',{id,scopeId:scope.id||scope})).json();}

export function messageSpeechData(message,selectedText){
 const ctx=getContext(),messages=[...document.querySelectorAll('#chat .mes')],index=messages.indexOf(message);
 const describe=item=>{const raw=ctx.chat?.[Number(item.getAttribute('mesid'))];const name=raw?.name||item.getAttribute('ch_name')||item.querySelector('.name_text')?.textContent?.trim()||'旁白';
  const avatar=raw?.original_avatar||(!raw?.is_user&&!ctx.groupId?ctx.characters?.[ctx.characterId]?.avatar:null);
  return {id:raw?.is_user||item.getAttribute('is_user')==='true'?'persona:'+name:avatar?'character:'+avatar:'name:'+name,name,text:(item.querySelector('.mes_text')?.innerText||item.querySelector('.mes_text')?.textContent||'').slice(0,500)};};
 const fullText=message?.querySelector('.mes_text')?.innerText||message?.querySelector('.mes_text')?.textContent||'';
 const context=index>=0?messages.slice(Math.max(0,index-2),index+3).map(describe):[];
 return {text:selectedText??fullText,fullText,context,scope:selectedText===undefined?'full':'selection',label:message?.getAttribute('ch_name')||'消息',cardScope:currentSpeechScope()};
}
export function currentSpeechScope(){const ctx=getContext();if(ctx.groupId)return {id:'group:'+ctx.groupId,label:ctx.groups?.find(x=>String(x.id)===String(ctx.groupId))?.name||'群聊'};const card=ctx.characters?.[ctx.characterId];return card?.avatar?{id:'card:'+card.avatar,label:card.name||card.avatar}:{id:'manual',label:'临时文本'};}
export function currentCardImageSource(){const ctx=getContext(),card=ctx.characters?.[ctx.characterId];if(!card)return null;const text=(card.first_mes||card.description||card.personality||card.scenario||card.name||'').trim();if(!text)return null;return {text,fullText:text,context:[{name:card.name||'角色',text:(card.description||'').slice(0,500)}],label:(card.name||'角色卡')+(card.first_mes?' 开场白':' 设定'),cardScope:currentSpeechScope()};}
export function initSelectionTts(isEnabled=()=>true,onSelect=()=>{}){
 if(document.querySelector('#xingzhan-selection-tts'))return;
 const action=document.createElement('button');action.id='xingzhan-selection-tts';action.className='menu_button';action.textContent='选区配音';action.type='button';action.hidden=true;action.popover='manual';document.body.append(action);let timer,data;
 const hide=()=>{action.hidden=true;if(action.matches(':popover-open'))action.hidePopover();};
 const capture=()=>{if(!isEnabled()){hide();return;}const selection=window.getSelection();if(!selection?.rangeCount||selection.isCollapsed){hide();return;}const range=selection.getRangeAt(0),element=node=>node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement;
  const start=element(range.startContainer)?.closest('#chat .mes_text'),end=element(range.endContainer)?.closest('#chat .mes_text');
  if(!start||start!==end||start.closest('[contenteditable="true"]')){hide();return;}const text=selection.toString().trim();if(!text){hide();return;}data=messageSpeechData(start.closest('.mes'),text);action.hidden=false;if(!action.matches(':popover-open'))action.showPopover();};
 const onChange=()=>{clearTimeout(timer);timer=setTimeout(capture,120);};document.addEventListener('selectionchange',onChange);
 action.addEventListener('pointerdown',event=>event.preventDefault());action.addEventListener('click',()=>{hide();if(isEnabled()&&data)onSelect(data);});
 return {stop:hide,destroy:()=>{clearTimeout(timer);document.removeEventListener('selectionchange',onChange);hide();action.remove();}};
}
export async function analyzeSpeech(text,context=[],signal,storage={}){const enabled=document.querySelector('#xingzhan-speech-dialog [data-world-reference]')?.checked===true;const world=enabled?await loadSpeechWorldReferences(text,context,undefined,storage.scopeId):{entries:[],books:[]};if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const output=document.querySelector('[data-world-status]');if(output)output.textContent=worldReferenceStatus(world);return mediaRequest('analyze',{text,context,...storage,worldReferences:world.entries,speakers:context.map(item=>({id:item.id,name:item.name})).filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index)},signal).then(r=>r.json());}
export function loadVoiceMemory(scope=currentSpeechScope()){return mediaRequest('memory?scope='+encodeURIComponent(scope.id)).then(r=>r.json());}
export function saveVoiceMemory(characters,scope=currentSpeechScope()){return mediaRequest('memory',{characters,scopeId:scope.id,scopeLabel:scope.label}).then(r=>r.json());}
export function listSpeechSessions(scope){return mediaRequest('sessions?scope='+encodeURIComponent(scope.id)).then(r=>r.json());}
export function loadSpeechSession(id,scope){return mediaRequest('session/'+encodeURIComponent(id)+'?scope='+encodeURIComponent(scope.id)).then(r=>r.json());}
export function saveSpeechSession(record,scope){return mediaRequest('session',{...record,scopeId:scope.id,scopeLabel:scope.label}).then(r=>r.json());}


// Local matching only: actual character extraction shares the normal analysis request.
export function selectSpeechWorldEntries(books,text,context=[]){
 const haystack=(text+'\n'+context.map(x=>x.text||'').join('\n')).toLowerCase(),matches=[];let scanned=0,disabled=0;
 for(const book of books){for(const entry of Object.values(book.data?.entries||{})){
  scanned++;if(entry.disable===true){disabled++;continue;}
  const keys=[...(Array.isArray(entry.key)?entry.key:[]),...(Array.isArray(entry.keysecondary)?entry.keysecondary:[])].map(String).filter(x=>x.trim().length>=2);
  const title=String(entry.comment||''),tokens=[...keys,...title.split(/[\s·:：,，()（）\[\]【】]/)].filter(x=>x.length>=2&&x.length<=80);
  const hits=tokens.filter(x=>haystack.includes(x.toLowerCase()));if(!hits.length)continue;
  matches.push({world:book.name,uid:String(entry.uid??''),title:title.slice(0,160),keys:keys.slice(0,10),content:String(entry.content||'').slice(0,1000),score:hits.length});
 }}
 matches.sort((a,b)=>b.score-a.score);const seen=new Set(),entries=matches.filter(x=>{const id=x.world+'\n'+x.uid;if(seen.has(id))return false;seen.add(id);return true;}).slice(0,12).map(({score,...entry})=>entry);
 return {books:books.map(x=>x.name),entries,scanned,disabled,omitted:Math.max(0,seen.size-entries.length)};
}
export async function loadSpeechWorldReferences(text,context=[],ctx=getContext(),targetScope=null){
 if(targetScope?.startsWith('group:')||!targetScope&&ctx.groupId)return {books:[],entries:[],groupUnsupported:true};
 let card=targetScope?.startsWith('card:')?ctx.characters?.find(x=>x.avatar===targetScope.slice(5)):targetScope?null:ctx.characters?.[ctx.characterId];if(!card)return {books:[],entries:[]};
 if(card.shallow){const avatar=card.avatar;if(typeof ctx.unshallowCharacter!=='function')throw Error('角色卡完整资料尚未加载');await ctx.unshallowCharacter(ctx.characters.indexOf(card));card=ctx.characters.find(x=>x.avatar===avatar);if(!card||card.shallow)throw Error('角色卡完整资料加载失败');}
 const world=await import('/scripts/world-info.js'),file=card.avatar?.replace(/\.[^/.]+$/,''),names=new Set([card.data?.extensions?.world,...world.world_info?.charLore?.find(x=>x.name===file)?.extraBooks||[]].filter(x=>typeof x==='string'&&x));
 const books=[];for(const name of names){const data=await world.loadWorldInfo(name);if(!data)throw Error('无法读取关联世界书：'+name);books.push({name,data});}
 return selectSpeechWorldEntries(books,text,context);
}
export function worldReferenceStatus(world){return world.groupUnsupported?'群聊暂不自动读取世界书；本次只使用正文和附近消息。':world.books.length?'当前卡关联 '+world.books.length+' 本世界书，匹配 '+world.entries.length+' 条参考'+(world.omitted?'，另有 '+world.omitted+' 条超出参考上限':'')+'；仅相关摘要随分析发送，不额外请求模型。':'当前角色卡没有关联世界书。';}
export function speechReviewReasons(segment){
 if(segment.reviewConfirmed)return [];
 if(Array.isArray(segment.reviewReasons))return segment.reviewReasons;
 const reasons=[];if(segment.type==='dialogue'){reasons.push('旧记录人物归属尚未核对');if(['narrator','__unresolved__'].includes(segment.speakerId))reasons.push('发言人待确认');if(!/[“”「」『』"]/.test(segment.text)&&/抬手|转身|拎着|走向|看向|站起/.test(segment.text))reasons.push('动作描写可能被当成台词');}return reasons;
}
export function unresolvedSpeechSegments(result){return result.segments.filter(x=>x.type==='dialogue'&&(['narrator','__unresolved__'].includes(x.speakerId)||x.identityEvidenceConflict||result.speakers?.find(p=>p.id===x.speakerId)?.identityConflict)&&!x.reviewConfirmed);}
const REVIEW_FIELDS=['type','speakerId','emotion','intensity','style','system','voiceSource','reviewConfirmed','reviewConfirmedAt','reviewReasons','manualLocked','manualEdited','evidence','worldSources','identityEvidenceConflict','identityCorrection','speakerEvidenceCandidates'];
export function speechReviewSnapshot(result,label){return {label,at:new Date().toISOString(),segments:result.segments.map(x=>Object.fromEntries(REVIEW_FIELDS.filter(k=>k in x).map(k=>[k,structuredClone(x[k])]))),speakers:structuredClone(result.speakers||[])};}
export function pushSpeechReviewUndo(result,label){result.reviewHistory=[...(result.reviewHistory||[]),speechReviewSnapshot(result,label)].slice(-10);}
export function undoSpeechReview(result){const state=result.reviewHistory?.pop();if(!state||!state.fullSegments&&state.segments.length!==result.segments.length)return false;if(state.fullSegments)result.segments=structuredClone(state.fullSegments);result.segments.forEach((segment,i)=>{for(const k of REVIEW_FIELDS)delete segment[k];Object.assign(segment,state.segments[i]);});result.speakers=state.speakers;for(const p of result.speakers)if(p.identityConfirmed)p.identityConfirmedAt=new Date().toISOString();result.reviewNotice='已撤销：'+state.label;return true;}
export function planSpeechIdentityMerge(result,sourceId,targetId){
 const source=result.speakers?.find(p=>p.id===sourceId&&!p.mergedInto),target=result.speakers?.find(p=>p.id===targetId&&!p.mergedInto);
 if(!source||!target||sourceId===targetId||[sourceId,targetId].some(id=>['narrator','__unresolved__'].includes(id)))throw Error('请选择两个不同的剧情人物');
 const affected=result.segments.map((s,index)=>({s,index})).filter(x=>x.s.speakerId===sourceId),locked=result.segments.filter(s=>[sourceId,targetId].includes(s.speakerId)&&s.manualLocked).length;
 return {source,target,indices:affected.map(x=>x.index),locked,evidence:affected.slice(0,6).map(x=>({index:x.index,text:x.s.text})),genderConflict:source.gender&&target.gender&&source.gender!=='unknown'&&target.gender!=='unknown'&&source.gender!==target.gender};
}
export function mergeSpeechIdentities(result,sourceId,targetId,defaultSystem){
 const plan=planSpeechIdentityMerge(result,sourceId,targetId);if(plan.locked)throw Error('涉及 '+plan.locked+' 个锁定片段，请先解锁后再合并');
 const voice=result.segments.find(s=>s.speakerId===targetId&&s.system)?.system.voice||plan.target.systemVoices?.find(v=>v.engine===defaultSystem?.engine)?.voice;
 if(result.segments.some(s=>s.speakerId===sourceId&&s.system)&&!voice)throw Error('保留人物没有可用系统音色，请先设置');
 const aliases=[...new Set([...(plan.target.aliases||[]),plan.source.name,...plan.source.aliases||[]])].filter(x=>x&&x!==plan.target.name&&!/^(他|她|它|我|你|您|他们|她们|自己|he|she|they|i|you)$/i.test(x));if(aliases.length>10)throw Error('合并后别名超过 10 个，请先整理别名');
 pushSpeechReviewUndo(result,'合并人物');const at=new Date().toISOString();plan.target.aliases=aliases;plan.target.identityConfirmed=true;plan.target.identityConfirmedAt=at;plan.target.identityConflict=false;plan.source.mergedInto=targetId;plan.source.identityConfirmed=true;plan.source.identityConfirmedAt=at;
 for(const index of plan.indices){const s=result.segments[index];s.speakerId=targetId;s.manualEdited=true;s.reviewConfirmed=true;s.reviewConfirmedAt=at;s.identityEvidenceConflict=false;s.reviewReasons=[];if(s.system){s.system={...s.system,voice};s.voiceSource='manual';}}
 result.reviewNotice='已将 '+plan.source.name+' 合并到 '+plan.target.name+'，处理 '+plan.indices.length+' 段，保留目标人物音色；可撤销。历史配音记录不改写。';return plan.indices.length;
}
export function applySpeechBatch(result,indices,action,speakerId,defaultSystem){
 const targets=[...new Set(indices)].filter(i=>Number.isInteger(i)&&result.segments[i]),editable=targets.filter(i=>!result.segments[i].manualLocked);if(action==='unlock'){if(!targets.length)return 0;pushSpeechReviewUndo(result,'批量解锁');for(const i of targets)result.segments[i].manualLocked=false;return targets.length;}
 if(!editable.length)return 0;if(action==='speaker'&&!result.speakers?.some(x=>x.id===speakerId))throw Error('请先选择有效人物');pushSpeechReviewUndo(result,'批量'+({narration:'改为旁白',speaker:'分配人物',lock:'锁定',confirm:'确认'}[action]||action));
 for(const i of editable){const x=result.segments[i];if(action==='lock'){x.manualLocked=true;continue;}if(action==='narration'||action==='speaker'){x.type=action==='narration'?'narration':'dialogue';x.speakerId=action==='narration'?'narrator':speakerId;x.manualEdited=true;x.reviewConfirmed=false;x.reviewReasons=['批量修改后，请核对并确认'];if(x.system){const voice=result.segments.find(y=>y!==x&&y.speakerId===x.speakerId&&y.system)?.system.voice||result.speakers?.find(p=>p.id===x.speakerId)?.systemVoices?.find(v=>v.engine===defaultSystem?.engine)?.voice||defaultSystem?.voice||x.system.voice;x.system={...x.system,voice};x.voiceSource='manual';}}
 if(action==='confirm'&&!(x.type==='dialogue'&&x.speakerId==='__unresolved__')){x.reviewConfirmed=true;x.reviewConfirmedAt=new Date().toISOString();}}
 return editable.length;
}
export function mountSpeechReviewTools(host,result,onSave,isBusy=()=>false,options={}){
 let plannedRange=null;const toolbar=document.createElement('div');toolbar.className='xs-review-tools';toolbar.innerHTML='<p data-review-overview role="status"></p><label>查看范围<select class="text_pole" data-review-filter><option value="doubts">需要确认的疑点</option><option value="all">全部片段</option><option value="roles">角色与音色</option></select></label><p>修改仅影响当前记录；确认人物身份后可在同一卡内复用。锁定片段不参与批量纠正或局部分析。</p><details data-batch-tools><summary>批量纠正、锁定与撤销</summary><div class="xs-actions"><button type="button" class="menu_button" data-select-visible>选择当前可见片段</button><button type="button" class="menu_button" data-clear-selection>清空选择</button></div><label>批量分配人物<select class="text_pole" data-batch-speaker></select></label><div class="xs-actions"><button type="button" class="menu_button" data-batch="narration">所选改为旁白</button><button type="button" class="menu_button" data-batch="speaker">所选归给人物</button><button type="button" class="menu_button" data-batch="confirm">确认所选</button><button type="button" class="menu_button" data-batch="lock">锁定所选</button><button type="button" class="menu_button" data-batch="unlock">解锁所选</button><button type="button" class="menu_button" data-review-undo>撤销上一次修改</button></div><p data-selection-status></p></details><details data-local-analysis><summary>局部重新分析（调用文本 API）</summary><p>仅处理所选且未锁定的片段，附带前后原文和已保存的世界书摘要。最多 120 段、20 次请求；失败或取消时原记录保留。不会自动生成语音。</p><button type="button" class="menu_button" data-local-plan>检查范围</button><p data-local-plan-status></p><button type="button" class="menu_button" data-local-run disabled>确认请求局部分析</button><button type="button" class="menu_button" data-local-cancel disabled>取消局部分析</button></details><details data-identity-editor><summary>人物身份与别名</summary><button type="button" class="menu_button" data-identities-load>读取当前卡已确认人物</button><select class="text_pole" data-identities-known><option value="">请选择已确认人物</option></select><button type="button" class="menu_button" data-identities-add>加入当前人物列表</button><p>加入后可批量将台词分配给该身份；不会自动合并同名人物。</p><div data-identity-list></div></details><p data-review-notice role="status"></p>';
 const mergeBox=document.createElement('details');mergeBox.innerHTML='<summary>人物合并与重名核对</summary><p>仅合并当前记录的台词，保留目标人物的身份、性别和音色，来源姓名加入别名。历史配音不改写；锁定项须先解锁。</p><label>待合并人物<select class="text_pole" data-merge-source></select></label><label>保留的人物及音色<select class="text_pole" data-merge-target></select></label><button type="button" class="menu_button" data-merge-preview>核对影响范围</button><pre data-merge-report style="white-space:pre-wrap"></pre><label><input type="checkbox" data-merge-confirm>我已核对，确认是同一人物并保留目标音色</label><button type="button" class="menu_button" data-merge-apply disabled>确认合并</button><p data-name-conflicts></p>';toolbar.append(mergeBox);
 const liveProfiles=(result.speakers||[]).filter(p=>!p.mergedInto&&!['narrator','__unresolved__'].includes(p.id));for(const select of mergeBox.querySelectorAll('select'))for(const p of liveProfiles){const o=document.createElement('option');o.value=p.id;o.textContent=(p.name||p.id)+' · '+p.id+' · '+(p.gender||'unknown')+' · '+(options.voiceMap?.[p.id]||result.segments.find(s=>s.speakerId===p.id&&s.system)?.system.voice||p.voiceSuggestion||'默认音色');select.append(o);}
 const collisions=liveProfiles.filter(p=>liveProfiles.some(q=>q.id!==p.id&&[q.name,...q.aliases||[]].some(n=>[p.name,...p.aliases||[]].includes(n))));mergeBox.querySelector('[data-name-conflicts]').textContent=collisions.length?'重名/别名重叠：'+collisions.map(p=>p.name+'（'+p.id+'）').join('、')+'。同名不代表同一人；不同人物可在身份编辑中改显示名并整理别名。':'未发现同名或别名重叠。';
 let mergePlan=null;const invalidateMerge=()=>{mergePlan=null;mergeBox.querySelector('[data-merge-confirm]').checked=false;mergeBox.querySelector('[data-merge-apply]').disabled=true;};for(const select of mergeBox.querySelectorAll('select'))select.onchange=invalidateMerge;
 mergeBox.querySelector('[data-merge-preview]').onclick=()=>{if(isBusy()||localBusy)return;invalidateMerge();try{mergePlan=planSpeechIdentityMerge(result,mergeBox.querySelector('[data-merge-source]').value,mergeBox.querySelector('[data-merge-target]').value);mergeBox.querySelector('[data-merge-report]').textContent='影响 '+mergePlan.indices.length+' 段；锁定 '+mergePlan.locked+' 段'+(mergePlan.genderConflict?'；性别资料不一致，请特别核对':'')+'\n'+mergePlan.evidence.map(x=>(x.index+1)+'. '+x.text.slice(0,180)).join('\n');}catch(e){mergeBox.querySelector('[data-merge-report]').textContent=e.message;}};
 mergeBox.querySelector('[data-merge-confirm]').onchange=e=>{mergeBox.querySelector('[data-merge-apply]').disabled=!e.target.checked||!mergePlan||!!mergePlan.locked;};
 mergeBox.querySelector('[data-merge-apply]').onclick=()=>{if(isBusy()||localBusy||!mergePlan||!mergeBox.querySelector('[data-merge-confirm]').checked)return;try{mergeSpeechIdentities(result,mergePlan.source.id,mergePlan.target.id,options.defaultSystem);changed();}catch(e){mergeBox.querySelector('[data-merge-report]').textContent=e.message;}};
 host.prepend(toolbar);const rows=[],selected=new Set(),filter=toolbar.querySelector('[data-review-filter]'),overview=toolbar.querySelector('[data-review-overview]'),notice=toolbar.querySelector('[data-review-notice]'),batchSpeaker=toolbar.querySelector('[data-batch-speaker]');let planned=null,localBusy=false;
 for(const profile of result.speakers||[]){if(profile.id==='__unresolved__'||profile.mergedInto)continue;const choice=document.createElement('option');choice.value=profile.id;choice.textContent=profile.name||profile.id;batchSpeaker.append(choice);}
 const changed=()=>{onSave();options.onRebuild?.();if(!options.onRebuild)refresh();};
 const refresh=()=>{const doubts=result.segments.filter(x=>speechReviewReasons(x).length).length;overview.textContent=(result.speakers||[]).filter(x=>!['narrator','__unresolved__'].includes(x.id)).length+' 个剧情人物 · '+result.segments.length+' 个片段 · '+doubts+' 处疑点'+(!result.classificationVersion?'（旧记录，未评估置信度）':'');for(const {row,segment,summary,reasons,index,check} of rows){const issues=speechReviewReasons(segment),profile=result.speakers?.find(x=>x.id===segment.speakerId);summary.textContent=(index+1)+'. '+(profile?.name||segment.speakerId)+' · '+({narration:'旁白',dialogue:'台词',sfx:'音效',bgm:'音乐',ambience:'环境音'}[segment.type]||segment.type)+' · '+(segment.manualLocked?'已锁定 · ':'')+(issues.length?'待确认':segment.reviewConfirmed?'已确认':'未触发疑点')+' · '+segment.text.slice(0,70);reasons.textContent=issues.join('；')||(segment.reviewConfirmed?'已手动确认':'未触发当前检查规则');row.hidden=filter.value==='roles'||filter.value==='doubts'&&!issues.length;check.checked=selected.has(index);for(const input of row.querySelectorAll('[data-review-edit-body] select,[data-review-edit-body] input,[data-confirm-classification]'))input.disabled=segment.manualLocked||isBusy()||localBusy;row.dataset.manualLocked=String(!!segment.manualLocked);row.querySelector('[data-lock-segment]').textContent=segment.manualLocked?'解锁本段':'锁定本段';}
 for(const node of host.querySelectorAll('.xs-profile,[data-system-role]'))(node.closest('.xs-profile')||node.closest('label')).hidden=filter.value==='doubts';
 const editable=[...selected].filter(i=>!result.segments[i].manualLocked).length;toolbar.querySelector('[data-selection-status]').textContent='已选 '+selected.size+' 段；纠正/分析可处理 '+editable+' 段，跳过锁定 '+(selected.size-editable)+' 段。';toolbar.querySelector('[data-review-undo]').disabled=!result.reviewHistory?.length||isBusy()||localBusy;notice.textContent=result.reviewNotice||'';for(const node of host.querySelectorAll('.xs-profile[data-profile-id] select'))node.disabled=isBusy()||localBusy||result.segments.some(x=>x.speakerId===node.closest('.xs-profile').dataset.profileId&&x.manualLocked);host.dataset.reviewDoubts=String(doubts);host.dispatchEvent(new CustomEvent('xs-review-update',{bubbles:true}));};
 filter.onchange=()=>{planned=null;toolbar.querySelector('[data-local-run]').disabled=true;refresh();};
 const selectionChanged=()=>{plannedRange=null;planned=null;toolbar.querySelector('[data-local-run]').disabled=true;toolbar.querySelector('[data-local-plan-status]').textContent='';refresh();};
 toolbar.querySelector('[data-select-visible]').onclick=()=>{if(isBusy()||localBusy)return;for(const {row,index} of rows)if(!row.hidden)selected.add(index);selectionChanged();};toolbar.querySelector('[data-clear-selection]').onclick=()=>{selected.clear();selectionChanged();};
 for(const button of toolbar.querySelectorAll('[data-batch]'))button.onclick=()=>{if(isBusy()||localBusy)return;const action=button.dataset.batch;try{const count=applySpeechBatch(result,[...selected],action,batchSpeaker.value,options.defaultSystem);result.reviewNotice=count?'已处理 '+count+' 段；锁定项不参与纠正。':'没有可处理的片段，请选择或先解锁。';changed();}catch(error){notice.textContent=error.message;}};
 toolbar.querySelector('[data-review-undo]').onclick=()=>{if(isBusy()||localBusy)return;if(undoSpeechReview(result))changed();};
 for(const profile of result.speakers||[]){if(profile.mergedInto||['narrator','__unresolved__'].includes(profile.id))continue;const row=document.createElement('div');row.className='xs-identity';row.innerHTML='<b></b><label>显示名<input class="text_pole" data-identity-name maxlength="80"></label><label>已确认别名（逗号分隔）<input class="text_pole" data-identity-aliases maxlength="800"></label><label><input type="checkbox" data-preserve-name checked>改名时保留旧名作为别名（区分同名人物时可取消）</label><button class="menu_button" type="button" data-identity-confirm>确认此人物身份</button><small></small>';row.querySelector('b').textContent=profile.name+' · '+profile.id;row.querySelector('[data-identity-name]').value=profile.name||'';row.querySelector('[data-identity-aliases]').value=(profile.aliases||[]).join(',');row.querySelector('small').textContent=profile.identityConfirmed?'已确认；身份在当前卡内复用':'模型候选；尚未人工确认身份';row.querySelector('[data-identity-confirm]').onclick=()=>{if(isBusy()||localBusy)return;const name=row.querySelector('[data-identity-name]').value.trim(),aliases=row.querySelector('[data-identity-aliases]').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean);if(!name||aliases.some(x=>/^(他|她|它|我|你|您|他们|她们|自己|he|she|they|i|you)$/i.test(x))){notice.textContent='请填写人物姓名；他/她等指代不能作为永久别名。';return;}pushSpeechReviewUndo(result,'确认人物身份');const oldName=profile.name;profile.name=name;profile.aliases=[...new Set([...aliases,...(row.querySelector('[data-preserve-name]').checked&&oldName&&oldName!==name?[oldName]:[])])].filter(x=>x!==name).slice(0,10);profile.identityConfirmed=true;profile.identityConfirmedAt=new Date().toISOString();profile.identityConflict=false;result.reviewNotice='已确认 '+name+'；身份和别名随当前记录保存，音色配置保持。';changed();};toolbar.querySelector('[data-identity-list]').append(row);}
 let knownIdentities=[];toolbar.querySelector('[data-identities-load]').onclick=async()=>{if(isBusy()||localBusy||!options.scope)return;try{const data=await (await mediaRequest('identities?scope='+encodeURIComponent(options.scope.id))).json();if(!host.isConnected)return;knownIdentities=data.identities;const select=toolbar.querySelector('[data-identities-known]');select.replaceChildren();for(const p of knownIdentities){const option=document.createElement('option');option.value=p.id;option.textContent=p.name+' · '+p.id;select.append(option);}notice.textContent=knownIdentities.length?'已读取 '+knownIdentities.length+' 个确认身份；同名条目仍分别保留。':'当前卡尚未确认人物身份。';}catch(error){notice.textContent=error.message;}};
 toolbar.querySelector('[data-identities-add]').onclick=()=>{if(isBusy()||localBusy)return;const p=knownIdentities.find(x=>x.id===toolbar.querySelector('[data-identities-known]').value);if(!p){notice.textContent='请先读取并选择人物。';return;}if(result.speakers.some(x=>x.id===p.id)){notice.textContent='此身份已经在当前人物列表中。';return;}pushSpeechReviewUndo(result,'加入已确认人物');result.speakers.push({...p,identityConfirmed:true});result.reviewNotice='已加入 '+p.name+'；可选择台词并批量分配给此人物。';changed();};
 const planStatus=toolbar.querySelector('[data-local-plan-status]'),run=toolbar.querySelector('[data-local-run]'),cancel=toolbar.querySelector('[data-local-cancel]');
 toolbar.querySelector('[data-local-plan]').onclick=()=>{if(isBusy()||localBusy)return;plannedRange=null;const indices=[...selected].filter(i=>!result.segments[i].manualLocked).sort((a,b)=>a-b),groups=[];for(const i of indices){const last=groups.at(-1);if(last&&last.at(-1)===i-1&&last.length<60&&last.reduce((n,j)=>n+result.segments[j].text.length,0)+result.segments[i].text.length<=6000)last.push(i);else groups.push([i]);}planned=indices;planStatus.textContent=indices.length?'片段 '+indices.map(i=>i+1).join(', ')+'；'+groups.length+' 次文本请求，共 '+indices.reduce((n,i)=>n+result.segments[i].text.length,0)+' 字符。'+(selected.size-indices.length?'已排除锁定项。':''):'请先选择未锁定的片段。';run.disabled=!options.onReanalyze||!indices.length||indices.length>120||groups.length>20||indices.some(i=>result.segments[i].text.length>12000);};
 run.onclick=async()=>{if(isBusy()||localBusy||!planned?.length)return;const indices=[...planned];localBusy=true;run.disabled=true;cancel.disabled=false;planStatus.textContent='正在局部分析；不会生成语音…';refresh();try{await options.onReanalyze(indices,plannedRange);planStatus.textContent='局部分析已保存。';}catch(error){planStatus.textContent=error.message;}finally{localBusy=false;cancel.disabled=true;planned=null;refresh();}};cancel.onclick=()=>options.onCancelReanalyze?.();
 host.__xsReviewRefresh=refresh;return {refresh,decorate(row,segment,index){const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div'),reasons=document.createElement('p');details.dataset.reviewSegment='';body.dataset.reviewEditBody='';reasons.className='xs-review-reasons';body.append(...row.childNodes);details.append(summary,reasons,body);
 const selection=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.reviewSelect=String(index);selection.append(check,'选择第 '+(index+1)+' 段');check.onchange=()=>{if(isBusy()||localBusy){check.checked=selected.has(index);return;}check.checked?selected.add(index):selected.delete(index);selectionChanged();};
 const partial=document.createElement('details');partial.innerHTML='<summary>选择本段内文字重新分析</summary><p>长按选中文字，再点击检查选区。只读正文；分析成功后拆分为前文、选区及后文。未选部分保留原分类，整段音频需重新生成。</p><textarea class="text_pole" data-local-text readonly rows="5"></textarea><button type="button" class="menu_button" data-local-range-plan>检查选区</button><p data-local-range-status></p>';const rawSelection=partial.querySelector('textarea');rawSelection.value=segment.text;partial.querySelector('button').onclick=async()=>{if(isBusy()||localBusy||segment.manualLocked)return;const start=rawSelection.selectionStart,end=rawSelection.selectionEnd;if(start===end||!segment.text.slice(start,end).trim()){partial.querySelector('[data-local-range-status]').textContent='请先在上方正文中选择需要分析的文字。';return;}const range={index,start,end};selectionChanged();try{const record=await options.getLocalRecord?.();if(!record)throw Error('请先保存当前记录');const plan=await(await mediaRequest('reanalyze/plan',{sessionId:record.id,expectedRevision:record.reviewRevision,scopeId:options.scope.id,range})).json();if(isBusy()||localBusy||segment.manualLocked)return;selected.clear();planned=[index];plannedRange=range;planStatus.textContent='第 '+(index+1)+' 段内 '+(end-start)+' 字符，'+plan.units+' 个原文单元，'+plan.calls+' 次文本请求。选区：'+plan.text;partial.querySelector('[data-local-range-status]').textContent='选区已预览，请点击“确认请求局部分析”。';run.disabled=!options.onReanalyze;}catch(error){partial.querySelector('[data-local-range-status]').textContent=error.message;return;}toolbar.querySelector('[data-local-analysis]').open=true;};body.append(partial);
 const evidence=document.createElement('p');evidence.textContent='依据：'+((segment.evidence||[]).map(x=>x.text).join(' / ')||'模型未给出可核对的原文依据。');body.append(evidence);const refs=document.createElement('p');refs.textContent=(segment.worldSources||[]).map(x=>'参考：'+x.world+' / '+(x.title||x.uid)).join('\n');if(refs.textContent)body.append(refs);const nearby=document.createElement('details');nearby.innerHTML='<summary>查看前后原文</summary>';const raw=document.createElement('p');raw.textContent=result.segments.slice(Math.max(0,index-1),index+2).map(x=>x.text).join('');nearby.append(raw);body.append(nearby);
 const confirm=document.createElement('button');confirm.type='button';confirm.className='menu_button';confirm.dataset.confirmClassification='';confirm.textContent='确认本段类型与人物';confirm.onclick=()=>{if(isBusy()||localBusy||segment.manualLocked)return;if(segment.type==='dialogue'&&segment.speakerId==='__unresolved__'){reasons.textContent='请先选择实际人物，或将类型改为旁白，再确认。';return;}pushSpeechReviewUndo(result,'确认本段');segment.reviewConfirmed=true;segment.reviewConfirmedAt=new Date().toISOString();onSave();refresh();};body.append(confirm);
 const lock=document.createElement('button');lock.type='button';lock.className='menu_button';lock.dataset.lockSegment='';lock.onclick=()=>{if(isBusy()||localBusy)return;pushSpeechReviewUndo(result,segment.manualLocked?'解锁本段':'锁定本段');segment.manualLocked=!segment.manualLocked;onSave();refresh();};
 body.addEventListener('change',event=>{if(event.target.matches('select,input')){if(segment.manualLocked||isBusy()||localBusy){event.stopImmediatePropagation();return;}pushSpeechReviewUndo(result,'修改第 '+(index+1)+' 段');}},true);
 body.addEventListener('input',event=>{if(event.target.matches('input')){if(segment.manualLocked||isBusy()||localBusy){event.stopImmediatePropagation();return;}pushSpeechReviewUndo(result,'修改第 '+(index+1)+' 段');}},true);
 body.addEventListener('change',event=>{if(event.target.matches('[data-segment-type],[data-speaker],[data-system-type],[data-system-speaker]')){segment.reviewConfirmed=false;segment.manualEdited=true;segment.reviewReasons=['已修改，请确认本段类型与人物'];onSave();refresh();}});
 row.replaceChildren(selection,lock,details);rows.push({row,segment,summary,reasons,index,check});
 }};
}


// Application voice categories; neutral voices belong to the female pool by user preference.
export const API_VOICE_GENDERS={Kore:'female',Puck:'male',Aoede:'female',Leda:'female',Zephyr:'female'};
export function classifyVoiceGender(voice){
 const name=typeof voice==='string'?voice:String(voice?.name||'');if(API_VOICE_GENDERS[name])return API_VOICE_GENDERS[name];
 const label=(typeof voice==='object'?String(voice.gender||'')+' ':'')+name;
 if(/中性|无性别|neutral|unisex|androgynous/i.test(label))return 'female';
 if(/女|\b(female|woman|girl)\b/i.test(label))return 'female';if(/男|\b(male|man|boy)\b/i.test(label))return 'male';return 'unknown';
}
export function classifyCharacterGender(profile){
 const gender=String(profile?.gender||'').toLowerCase();if(['male','男','男性','男声'].includes(gender))return 'male';if(['female','女','女性','女声'].includes(gender))return 'female';if(['neutral','中性','无性别'].includes(gender))return 'neutral';
 const summary=String(profile?.summary||'');if(/女性|女孩|少女|女声|女人|\b(female|woman|girl|she|her)\b/i.test(summary))return 'female';if(/男性|男孩|少年|男声|男人|\b(male|man|boy|he|his)\b/i.test(summary))return 'male';if(/中性|无性别|neutral|unisex|androgynous/i.test(summary))return 'neutral';return 'unknown';
}
export function chooseGenderVoice(profile,available,{remembered=null,preferred='',used=[],narrator=false}={}){
 const gender=classifyCharacterGender(profile),target=gender==='neutral'?'female':gender,list=available.map(x=>typeof x==='string'?{name:x}:x).filter(x=>x.installed!==false);
 if(!list.length)return {voice:'',source:'auto',warning:'没有可用音色'};
 const memory=list.find(x=>x.name===(remembered?.voice||remembered?.voiceId));
 if(memory&&(remembered.voiceSource==='manual'||target==='unknown'||classifyVoiceGender(memory)===target))return {voice:memory.name,source:remembered.voiceSource==='manual'?'manual':'auto',warning:''};
 if(narrator&&list.some(x=>x.name===preferred))return {voice:preferred,source:'manual',warning:''};
 const matching=target==='unknown'?list:list.filter(x=>classifyVoiceGender(x)===target),fallback=list.filter(x=>classifyVoiceGender(x)==='unknown'),pool=matching.length?matching:fallback.length?fallback:list;
 const unused=pool.filter(x=>!used.includes(x.name)&&x.name!==preferred),suggested=pool.find(x=>x.name===profile.voiceSuggestion),chosen=suggested&&!used.includes(suggested.name)?suggested:unused[0]||pool[0];
 return {voice:chosen.name,source:'auto',warning:matching.length?'':'没有已标注的'+(target==='male'?'男性':'女性')+'音色，请试听或手动选择'};
}
export function voiceGenderLabel(voice){const gender=classifyVoiceGender(voice);return gender==='male'?'男性':gender==='female'?( /中性|neutral|unisex|androgynous/i.test(typeof voice==='string'?voice:voice.name)||voice==='Zephyr'?'女性（中性归类）':'女性'):'性别未标注';}
