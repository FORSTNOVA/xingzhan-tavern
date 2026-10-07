import fs from 'node:fs';

for (const file of ['plugins/xingzhan-synthesis/index.js', 'app/src/main/assets/xingzhan-synthesis-index.js']) {
  let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  // 1. Add quick bar into dialog HTML
  const targetBar = `  <div data-image-source-info style="font-size:0.88em;opacity:0.85;margin-bottom:8px;padding:8px 12px;background:rgba(255,255,255,0.06);border-radius:6px;border-left:3px solid var(--SmartThemeQuoteColor,#2979ff);"></div>

  <label>提示词 (Prompt)</label>`;

  const replacementBar = `  <div data-image-source-info style="font-size:0.88em;opacity:0.85;margin-bottom:8px;padding:8px 12px;background:rgba(255,255,255,0.06);border-radius:6px;border-left:3px solid var(--SmartThemeQuoteColor,#2979ff);"></div>

  <div data-image-quick-bar style="display:flex;align-items:center;gap:8px;margin:4px 0 10px 0;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:6px;border:1px solid rgba(255,255,255,0.12);">
   <span style="font-size:0.88em;white-space:nowrap;font-weight:bold;">🖼️ 生图引擎/模型:</span>
   <select data-image-quick-model class="text_pole" style="flex:1;font-size:0.88em;padding:4px 6px;margin:0;"></select>
   <button type="button" class="menu_button xs-mini-btn" data-image-quick-refresh title="刷新模型列表" style="margin:0;padding:4px 8px;">🔄</button>
  </div>

  <label>提示词 (Prompt)</label>`;

  if (content.includes(targetBar)) {
    content = content.replace(targetBar, replacementBar);
  }

  // 2. Add syncWorkbenchModels function and wire it up
  const targetMount = ` mount(imageDialog.querySelector('[data-kind="image"]'),'image').catch(()=>{});\n}`;
  const replacementMount = ` mount(imageDialog.querySelector('[data-kind="image"]'),'image').catch(()=>{});
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

  if (!content.includes('async function syncWorkbenchModels')) {
    if (!content.includes(targetMount)) throw new Error('targetMount not found in ' + file);
    content = content.replace(targetMount, replacementMount);
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated ' + file);
}
