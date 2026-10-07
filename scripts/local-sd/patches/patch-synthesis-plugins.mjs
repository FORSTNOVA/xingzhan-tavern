import fs from 'node:fs';

// --- 1. Patch plugins/xingzhan-synthesis/media.js ---
let media = fs.readFileSync('plugins/xingzhan-synthesis/media.js', 'utf8').replace(/\r\n/g, '\n');

// 1.1 Add prominent model selector to image-local form if not added yet
const targetLocalForm = `<div data-group="image-local">
  <label>本地引擎服务地址 (sd.cpp / WebUI 伴侣)</label><input data-field="localUrl" class="text_pole" placeholder="http://127.0.0.1:8789">`;

const replacementLocalForm = `<div data-group="image-local">
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
  <label>本地引擎服务地址 (sd.cpp / WebUI 伴侣)</label><input data-field="localUrl" class="text_pole" placeholder="http://127.0.0.1:8789">`;

if (media.includes(targetLocalForm)) {
 media = media.replace(targetLocalForm, replacementLocalForm);
}

// 1.2 Update updateLocalEngineStatus in media.js
const infoStart = media.indexOf('if(info){\n     const parts=[];');
const logsStart = media.indexOf('if(logs&&Array.isArray(res.logs)){');

if (infoStart !== -1 && logsStart !== -1) {
 const replacementEngineStatus = `// Update dedicated model selector
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
    `;
 media = media.slice(0, infoStart) + replacementEngineStatus + media.slice(logsStart);
}

fs.writeFileSync('plugins/xingzhan-synthesis/media.js', media, 'utf8');
fs.writeFileSync('app/src/main/assets/xingzhan-synthesis-media.js', media, 'utf8');
console.log('Successfully updated media.js and xingzhan-synthesis-media.js!');

// --- 2. Patch plugins/xingzhan-synthesis/index.js ---
let idx = fs.readFileSync('plugins/xingzhan-synthesis/index.js', 'utf8').replace(/\r\n/g, '\n');

// 2.1 Add model quick switcher bar into dialog HTML
const targetDialogBody = `  <div class="xs-dialog-body" data-image-workspace>
   <div data-image-source-info style="font-size:0.88em;opacity:0.85;margin-bottom:8px;padding:8px 12px;background:rgba(255,255,255,0.06);border-radius:6px;border-left:3px solid var(--SmartThemeQuoteColor,#2979ff);"></div>

   <label>提示词 (Prompt)</label>`;

const replacementDialogBody = `  <div class="xs-dialog-body" data-image-workspace>
   <div data-image-source-info style="font-size:0.88em;opacity:0.85;margin-bottom:8px;padding:8px 12px;background:rgba(255,255,255,0.06);border-radius:6px;border-left:3px solid var(--SmartThemeQuoteColor,#2979ff);"></div>

   <div data-image-quick-bar style="display:flex;align-items:center;gap:8px;margin:4px 0 10px 0;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:6px;border:1px solid rgba(255,255,255,0.12);">
    <span style="font-size:0.88em;white-space:nowrap;font-weight:bold;">🖼️ 生图引擎/模型:</span>
    <select data-image-quick-model class="text_pole" style="flex:1;font-size:0.88em;padding:4px 6px;margin:0;"></select>
    <button type="button" class="menu_button xs-mini-btn" data-image-quick-refresh title="刷新模型列表" style="margin:0;padding:4px 8px;">🔄</button>
   </div>

   <label>提示词 (Prompt)</label>`;

if (idx.includes(targetDialogBody)) {
 idx = idx.replace(targetDialogBody, replacementDialogBody);
}

// 2.2 Add syncWorkbenchModels function and its triggers
const targetCreateDialogEnd = `  mount(imageDialog.querySelector('[data-kind="image"]'),'image').catch(()=>{});
 }`;

const replacementCreateDialogEnd = `  mount(imageDialog.querySelector('[data-kind="image"]'),'image').catch(()=>{});
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
     const opt = new Option('本地: ' + m.name + ' (' + m.sizeMb + 'MB)', 'local:' + m.name);
     if (isCur) opt.selected = true;
     localGroup.appendChild(opt);
    }
   } else {
    const emptyOpt = new Option('未发现本地模型 (请放入 tools/local-sd)', 'local:none');
    emptyOpt.disabled = true;
    localGroup.appendChild(emptyOpt);
   }
   select.appendChild(localGroup);

   // Cloud relay optgroup
   const relayGroup = document.createElement('optgroup');
   relayGroup.label = '☁️ 云端中转模型';
   const relayModels = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];
   if (cfg.model && !relayModels.includes(cfg.model)) relayModels.unshift(cfg.model);
   for (const rm of relayModels) {
    const isCur = cfg.source !== 'local' && cfg.model === rm;
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
       await mediaRequest('config/image', { ...curCfg, source: 'local', selectedModel: modelName });
       await mediaRequest('local-engine/start', {});
       if (statusText) {
        statusText.textContent = '已切换为本地模型: ' + modelName;
        statusText.style.color = '#4caf50';
       }
       if (window.toastr?.success) window.toastr.success('已切换为本地模型: ' + modelName);
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
 }`;

if (idx.includes(targetCreateDialogEnd)) {
 idx = idx.replace(targetCreateDialogEnd, replacementCreateDialogEnd);
}

// Also sync models when dialog opens
const targetOpenDialog = ` activeScope=data?.cardScope||currentSpeechScope();`;
const replacementOpenDialog = ` activeScope=data?.cardScope||currentSpeechScope();
 if(imageDialog)syncWorkbenchModels(imageDialog);`;

if (idx.includes(targetOpenDialog)) {
 idx = idx.replace(targetOpenDialog, replacementOpenDialog);
}

fs.writeFileSync('plugins/xingzhan-synthesis/index.js', idx, 'utf8');
fs.writeFileSync('app/src/main/assets/xingzhan-synthesis-index.js', idx, 'utf8');
console.log('Successfully updated index.js and xingzhan-synthesis-index.js!');
