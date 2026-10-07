import fs from 'node:fs';
import path from 'node:path';

const repoRoot = 'd:/codebuddythink/jiuguan';
const pluginIndexFile = path.join(repoRoot, 'plugins/xingzhan-synthesis/index.js');
const assetIndexFile = path.join(repoRoot, 'app/src/main/assets/xingzhan-synthesis-index.js');

console.log('=== 开始构建并应用前端生成队列 UI 补丁 ===');

for (const f of [pluginIndexFile, assetIndexFile]) {
  if (!fs.existsSync(f)) throw new Error('Missing file: ' + f);
}

let indexSrc = fs.readFileSync(pluginIndexFile, 'utf8');

// 1. 检查 import 声明
if (!indexSrc.includes('getImageQueueStatus')) {
  indexSrc = indexSrc.replace(
    "import {showAnalysisFailureDiagnostic,form,mount,initSelectionTts,messageSpeechData,currentCardImageSource,mediaRequest,relayImage,generateImagePrompt,loadImageHistory,deleteImageHistory,",
    "import {showAnalysisFailureDiagnostic,form,mount,initSelectionTts,messageSpeechData,currentCardImageSource,mediaRequest,relayImage,getImageQueueStatus,cancelImageTask,generateImagePrompt,loadImageHistory,deleteImageHistory,"
  );
}

// 2. 插入队列卡片 HTML 模板
const queuePanelHtml = `
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
   </div>`;

// 在插图工作台窗口中插入
if (!indexSrc.includes('data-image-queue-panel')) {
  // 插图工作台窗口插入在 status 前面
  const targetWorkbenchInsert = `   <p data-image-status role="status" style="font-weight:bold;margin:6px 0;"></p>`;
  indexSrc = indexSrc.replace(targetWorkbenchInsert, `${queuePanelHtml}\n${targetWorkbenchInsert}`);

  // 主面板插入在 data-image-status 前面
  const targetPanelInsert = `<p data-image-status role="status"></p>`;
  indexSrc = indexSrc.replace(targetPanelInsert, `${queuePanelHtml}\n${targetPanelInsert}`);
}

// 3. 增加队列轮询与同步核心逻辑
const queueLogicCode = `
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
      if (promptEl) promptEl.textContent = \`[\${active.source==='local'?'本地SD':'云端'}] \${active.prompt} (\${active.ratio})\`;
      const elapsedEl = actBox.querySelector('[data-image-queue-elapsed]');
      if (elapsedEl) elapsedEl.textContent = \`已耗时: \${active.elapsedSeconds || 0}s\`;
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
       listEl.innerHTML = queue.map(item => \`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 6px;background:rgba(255,255,255,0.06);border-radius:4px;gap:6px;">
         <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">#\${item.position} [\${item.source==='local'?'本地':'云端'}] \${escapeHtml(item.prompt.slice(0,30))}... (\${item.ratio})</span>
         <button type="button" class="menu_button xs-mini-btn" data-cancel-queued-id="\${item.id}" style="color:#ff8a80!important;padding:1px 6px;margin:0;">取消</button>
        </div>
       \`).join('');
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
    if (stopBtn) stopBtn.disabled = false;
   } else {
    qPanel.style.display = 'none';
    const genBtn = r.querySelector('[data-image-generate]');
    if (genBtn) genBtn.textContent = '🎨 生成图片';
    const stopBtn = r.querySelector('[data-image-stop]');
    if (stopBtn) stopBtn.disabled = true;

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
`;

if (!indexSrc.includes('syncImageQueueUI()')) {
  // 放在 generateImage 之前
  indexSrc = indexSrc.replace(
    'export async function generateImage(prompt,ratio){',
    `${queueLogicCode}\nexport async function generateImage(prompt,ratio){`
  );
}

// 4. 重构 generateImage：支持队列并发提交、支持停止生成真正终止后台任务
const oldGenerateImgBlock = `export async function generateImage(prompt,ratio){
 const roots=getImageRoots();
 const activeRoot=(imageDialog&&imageDialog.open)?imageDialog:(roots[0]||document);
 prompt=String(prompt!=null?prompt:(activeRoot.querySelector('[data-image-prompt]')?.value||'')).trim();
 ratio=ratio!=null?ratio:(activeRoot.querySelector('[data-image-ratio]')?.value||'1:1');
 const setAllStatus=msg=>{for(const r of roots){const el=r.querySelector('[data-image-status]');if(el)el.textContent=msg;}};
 const setGenerating=running=>{
  for(const r of roots){
   const btn=r.querySelector('[data-image-generate]');if(btn)btn.disabled=running;
   const stop=r.querySelector('[data-image-stop]');if(stop)stop.disabled=!running;
  }
 };
 if(!prompt){setAllStatus('请先填写图片描述');return;}if(imageController)return;
 const controller=new AbortController();imageController=controller;const current=++imageEpoch;
 setGenerating(true);setAllStatus('正在生成图片…');
 try{
  const scope=activeScope||currentSpeechScope(),extra={scopeId:scope.id,scopeLabel:scope.label,source:lastImageSource};
  const result=await relayImage(prompt,ratio,controller.signal,extra);if(controller.signal.aborted||current!==imageEpoch)return;
  const url=await saveBase64AsFile(result.data,'xingzhan-synthesis','image-'+Date.now(),result.format);if(controller.signal.aborted||current!==imageEpoch)return;
  for(const r of roots){
   const preview=r.querySelector('[data-image-preview]');if(preview){preview.src=url;preview.hidden=false;}
   const link=r.querySelector('[data-image-link]');if(link){link.href=url;link.hidden=false;}
  }
  setAllStatus('生成成功，图片已保存到酒馆'+(result.historyError?'（'+result.historyError+'）':'与当前角色卡历史'));
  refreshImageHistory().catch(()=>{});
  return url;
 }catch(error){
  setAllStatus(controller.signal.aborted?'已停止生成':error.message);
 }finally{
  if(imageController===controller){imageController=null;setGenerating(false);}
 }
}`;

const newGenerateImgBlock = `export async function generateImage(prompt,ratio){
 const roots=getImageRoots();
 const activeRoot=(imageDialog&&imageDialog.open)?imageDialog:(roots[0]||document);
 prompt=String(prompt!=null?prompt:(activeRoot.querySelector('[data-image-prompt]')?.value||'')).trim();
 ratio=ratio!=null?ratio:(activeRoot.querySelector('[data-image-ratio]')?.value||'1:1');
 const setAllStatus=msg=>{for(const r of roots){const el=r.querySelector('[data-image-status]');if(el)el.textContent=msg;}};
 if(!prompt){setAllStatus('请先填写图片描述');return;}
 const current=++imageEpoch;
 setAllStatus('正在提交生图任务…');
 startQueuePolling();
 try{
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
 }
}`;

if (indexSrc.includes(oldGenerateImgBlock)) {
  indexSrc = indexSrc.replace(oldGenerateImgBlock, newGenerateImgBlock);
}

// 5. 绑定停止生成按钮与终止队列按钮事件
// 5.1 插图工作台窗口内的绑定
const oldDialogStopBind = ` imageDialog.querySelector('[data-image-stop]').onclick=()=>imageController?.abort();`;
const newDialogStopBind = ` imageDialog.querySelector('[data-image-stop]').onclick=async()=>{
  await cancelImageTask('all');
  syncImageQueueUI().catch(()=>{});
 };
 imageDialog.querySelector('[data-image-queue-cancel-active]')?.addEventListener('click', async()=>{
  await cancelImageTask('all');
  syncImageQueueUI().catch(()=>{});
 });`;

if (indexSrc.includes(oldDialogStopBind)) {
  indexSrc = indexSrc.replace(oldDialogStopBind, newDialogStopBind);
}

// 5.2 主面板设置内的绑定
const oldPanelStopBind = ` panel.querySelector('[data-image-stop]').addEventListener('click',()=>imageController?.abort());`;
const newPanelStopBind = ` panel.querySelector('[data-image-stop]').addEventListener('click',async()=>{
  await cancelImageTask('all');
  syncImageQueueUI().catch(()=>{});
 });
 panel.querySelector('[data-image-queue-cancel-active]')?.addEventListener('click', async()=>{
  await cancelImageTask('all');
  syncImageQueueUI().catch(()=>{});
 });`;

if (indexSrc.includes(oldPanelStopBind)) {
  indexSrc = indexSrc.replace(oldPanelStopBind, newPanelStopBind);
}

// 6. 在 openImageDialog 打开窗口时触发 syncImageQueueUI
const oldOpenDialogHead = `export async function openImageDialog(data){
 if(!imageDialog)createImageDialog();`;
const newOpenDialogHead = `export async function openImageDialog(data){
 if(!imageDialog)createImageDialog();
 syncImageQueueUI().catch(()=>{});`;

if (indexSrc.includes(oldOpenDialogHead)) {
  indexSrc = indexSrc.replace(oldOpenDialogHead, newOpenDialogHead);
}

// 7. 写入两个镜像文件
fs.writeFileSync(pluginIndexFile, indexSrc, 'utf8');
fs.writeFileSync(assetIndexFile, indexSrc, 'utf8');

console.log('✔ 已更新 plugins/xingzhan-synthesis/index.js 与 app/src/main/assets/xingzhan-synthesis-index.js');
