import fs from 'node:fs';
import path from 'node:path';

const repoRoot = 'd:/codebuddythink/jiuguan';
const androidMediaFile = path.join(repoRoot, 'app/src/main/assets/android-media.mjs');
const pluginMediaFile = path.join(repoRoot, 'plugins/xingzhan-synthesis/media.js');
const assetMediaFile = path.join(repoRoot, 'app/src/main/assets/xingzhan-synthesis-media.js');
const pluginIndexFile = path.join(repoRoot, 'plugins/xingzhan-synthesis/index.js');
const assetIndexFile = path.join(repoRoot, 'app/src/main/assets/xingzhan-synthesis-index.js');

console.log('=== 开始构建并应用生成队列补丁 ===');

// 1. 检查文件存在性
for (const f of [androidMediaFile, pluginMediaFile, assetMediaFile, pluginIndexFile, assetIndexFile]) {
  if (!fs.existsSync(f)) throw new Error('Missing file: ' + f);
}

// ----------------------------------------------------
// Step 1: 处理 android-media.mjs
// ----------------------------------------------------
let mediaSrc = fs.readFileSync(androidMediaFile, 'utf8');
if (mediaSrc.includes('stopLocalEngineRun')) {
  throw new Error('该队列补丁是旧版一次性脚本；当前实现已使用 stopLocalEngineRun，禁止重新应用。');
}

// 1.1 在本地引擎管理中加入 activeLocalEngineChild 与 cancelLocalEngineInference
if (!mediaSrc.includes('let activeLocalEngineChild = null;')) {
  mediaSrc = mediaSrc.replace(
    'let localEngineServer = null;',
    `let localEngineServer = null;\nlet activeLocalEngineChild = null;\n\nasync function cancelLocalEngineInference(req) {\n try {\n  if (activeLocalEngineChild) {\n   try { activeLocalEngineChild.kill('SIGTERM'); } catch {}\n   setTimeout(() => {\n    if (activeLocalEngineChild) {\n     try { activeLocalEngineChild.kill('SIGKILL'); } catch {}\n    }\n   }, 350);\n  }\n  const config = readConfig(req || { user: { directories: {} } }, 'image');\n  const localTarget = (config.localUrl || 'http://127.0.0.1:8789').replace(/\\/+$/, '');\n  const res = await fetch(localTarget + '/cancel', { method: 'POST', signal: AbortSignal.timeout(2000) }).catch(() => null);\n  if (res && res.ok) return await res.json().catch(() => null);\n } catch {}\n return null;\n}`
  );
}

// 1.2 在 startLocalEngineServer 中支持 POST /cancel 以及同步 activeLocalEngineChild
const targetPostBlock = `   if (isGenerating) {
    return sendJson(429, { error: '当前已有本地生图任务正在运行中，请等待上一张渲染完成，避免手机内存溢出。' });
   }`;

const replacementPostBlock = `   if (cReq.url === '/cancel' || cReq.url === '/sdapi/v1/cancel') {
    if (isGenerating && (activeChild || activeLocalEngineChild)) {
     const p = activeChild || activeLocalEngineChild;
     logLocalEngine('收到本地推理终止指令，正在终止底层推理进程 (PID: ' + p.pid + ')...');
     try { p.kill('SIGTERM'); } catch {}
     setTimeout(() => {
      try { p.kill('SIGKILL'); } catch {}
     }, 350);
     return sendJson(200, { success: true, message: '已向推理进程发送终止信号' });
    }
    return sendJson(200, { success: false, message: '当前无正在运行的本地推理进程' });
   }

   if (isGenerating) {
    return sendJson(429, { error: '当前已有本地生图任务正在运行中，请等待上一张渲染完成，避免手机内存溢出。', isGenerating: true });
   }`;

if (mediaSrc.includes(targetPostBlock)) {
  mediaSrc = mediaSrc.replace(targetPostBlock, replacementPostBlock);
}

// 同步 activeLocalEngineChild
if (mediaSrc.includes('activeChild = child;') && !mediaSrc.includes('activeLocalEngineChild = child;')) {
  mediaSrc = mediaSrc.replace('activeChild = child;', 'activeChild = child;\n      activeLocalEngineChild = child;');
}
if (mediaSrc.includes('activeChild = null;') && !mediaSrc.includes('activeLocalEngineChild = null;')) {
  mediaSrc = mediaSrc.replace('activeChild = null;', 'activeChild = null;\n     activeLocalEngineChild = null;');
}

// 1.3 升级 stopLocalEngineServer
if (mediaSrc.includes('function stopLocalEngineServer() {') && !mediaSrc.includes('if (activeLocalEngineChild) {')) {
  mediaSrc = mediaSrc.replace(
    'function stopLocalEngineServer() {',
    `function stopLocalEngineServer() {\n if (activeLocalEngineChild) {\n  try { activeLocalEngineChild.kill('SIGKILL'); } catch {}\n  activeLocalEngineChild = null;\n }`
  );
}

// 1.4 实现 ImageTaskQueue 并接入 generate('image')
const queueClassDefinition = `
class ImageTaskQueue {
 constructor() {
  this.activeTask = null;
  this.queue = [];
  this.lastFinishedTask = null;
 }

 getStatus() {
  return {
   isBusy: !!this.activeTask,
   activeTask: this.activeTask ? {
    id: this.activeTask.id,
    prompt: this.activeTask.prompt,
    ratio: this.activeTask.ratio,
    model: this.activeTask.model,
    source: this.activeTask.source,
    status: this.activeTask.status,
    startTime: this.activeTask.startTime,
    elapsedSeconds: Math.floor((Date.now() - (this.activeTask.startTime || Date.now())) / 1000)
   } : null,
   queue: this.queue.map((item, idx) => ({
    id: item.id,
    prompt: item.prompt,
    ratio: item.ratio,
    model: item.model,
    source: item.source,
    createdAt: item.createdAt,
    position: idx + 1
   })),
   lastFinishedTask: this.lastFinishedTask ? {
    id: this.lastFinishedTask.id,
    prompt: this.lastFinishedTask.prompt,
    ratio: this.lastFinishedTask.ratio,
    model: this.lastFinishedTask.model,
    source: this.lastFinishedTask.source,
    status: this.lastFinishedTask.status,
    finishedAt: this.lastFinishedTask.finishedAt,
    historyId: this.lastFinishedTask.historyId,
    error: this.lastFinishedTask.error || null,
    url: this.lastFinishedTask.historyId ? ('/api/android/media/image-history/' + this.lastFinishedTask.historyId + '/file') : null
   } : null
  };
 }

 async cancelTask(taskId, req) {
  let cancelledCount = 0;
  if (!taskId || taskId === 'all' || (this.activeTask && this.activeTask.id === taskId)) {
   if (this.activeTask) {
    const cancelled = this.activeTask;
    cancelled.status = 'cancelled';
    try { cancelled.controller.abort(); } catch {}
    if (typeof cancelled.onCancel === 'function') {
     try { cancelled.onCancel(); } catch {}
    }
    for (const sub of cancelled.subscribers) {
     if (!sub.res.headersSent && !sub.res.destroyed) {
      sub.res.status(499).json({ error: '当前生图任务已被手动终止', cancelled: true });
     }
    }
    this.lastFinishedTask = {
     id: cancelled.id,
     prompt: cancelled.prompt,
     ratio: cancelled.ratio,
     model: cancelled.model,
     source: cancelled.source,
     status: 'cancelled',
     finishedAt: Date.now(),
     error: '已被用户手动终止'
    };
    this.activeTask = null;
    cancelledCount++;
   }
  }

  if (taskId === 'all') {
   while (this.queue.length > 0) {
    const item = this.queue.shift();
    item.status = 'cancelled';
    for (const sub of item.subscribers) {
     if (!sub.res.headersSent && !sub.res.destroyed) {
      sub.res.status(499).json({ error: '任务已从生成队列移除', cancelled: true });
     }
    }
    cancelledCount++;
   }
  } else if (taskId) {
   const idx = this.queue.findIndex(t => t.id === taskId);
   if (idx !== -1) {
    const item = this.queue.splice(idx, 1)[0];
    item.status = 'cancelled';
    for (const sub of item.subscribers) {
     if (!sub.res.headersSent && !sub.res.destroyed) {
      sub.res.status(499).json({ error: '任务已从生成队列移除', cancelled: true });
     }
    }
    cancelledCount++;
   }
  }

  await cancelLocalEngineInference(req || this.activeTask?.req);
  this.dispatchNext();
  return { success: true, cancelledCount, status: this.getStatus() };
 }

 async enqueue(req, res) {
  try {
   const config = readConfig(req, 'image');
   const isLocalImage = config.source === 'local';
   const key = isLocalImage ? '' : readSecret(req.user.directories, secretName('image'));
   if (!isLocalImage && !key) {
    return res.status(400).json({ error: '请先保存中转令牌' });
   }
   const text = String(req.body.prompt || '').trim();
   if (!text || text.length > 16000) {
    return res.status(400).json({ error: '提示词为空或超过长度限制' });
   }
   const ratio = req.body.aspect_ratio || '1:1';
   if (!['1:1','3:4','4:3','9:16','16:9','2:3','3:2'].includes(ratio)) {
    return res.status(400).json({ error: '不支持的图片比例' });
   }

   const taskId = 'img-' + randomUUID();
   const task = {
    id: taskId,
    prompt: text,
    ratio,
    model: isLocalImage ? (String(req.body.model || config.selectedModel || '').trim() || 'local/sd-cpp') : config.model,
    source: isLocalImage ? 'local' : 'relay',
    config,
    req,
    reqBody: req.body,
    createdAt: Date.now(),
    startTime: null,
    status: 'queued',
    controller: new AbortController(),
    subscribers: [{ req, res }],
    onCancel: null
   };

   res.on('close', () => {
    task.subscribers = task.subscribers.filter(s => s.res !== res);
   });

   this.queue.push(task);
   this.dispatchNext();
  } catch (err) {
   if (!res.headersSent && !res.destroyed) {
    res.status(500).json({ error: String(err.message).slice(0, 300) });
   }
  }
 }

 async dispatchNext() {
  if (this.activeTask || this.queue.length === 0) return;
  const task = this.queue.shift();
  this.activeTask = task;
  task.startTime = Date.now();
  task.status = 'running';

  try {
   const out = await this.executeTask(task);
   task.status = 'completed';
   this.lastFinishedTask = {
    id: task.id,
    prompt: task.prompt,
    ratio: task.ratio,
    model: task.model,
    source: task.source,
    status: 'completed',
    finishedAt: Date.now(),
    historyId: out.historyId || null,
    data: out.data,
    format: out.format
   };

   for (const sub of task.subscribers) {
    if (!sub.res.headersSent && !sub.res.destroyed) {
     sub.res.set('Cache-Control', 'no-store').json(out);
    }
   }
  } catch (err) {
   if (task.status !== 'cancelled') {
    task.status = 'failed';
    this.lastFinishedTask = {
     id: task.id,
     prompt: task.prompt,
     ratio: task.ratio,
     model: task.model,
     source: task.source,
     status: 'failed',
     finishedAt: Date.now(),
     error: String(err.message).slice(0, 300)
    };
    for (const sub of task.subscribers) {
     if (!sub.res.headersSent && !sub.res.destroyed) {
      sub.res.status(500).json({ error: String(err.message).slice(0, 300) });
     }
    }
   }
  } finally {
   if (this.activeTask === task) {
    this.activeTask = null;
   }
   this.dispatchNext();
  }
 }

 async executeTask(task) {
  const { req, reqBody, prompt: text, ratio, config } = task;
  const isLocalImage = task.source === 'local';

  if (isLocalImage) {
   const dims={'1:1':{width:512,height:512},'3:4':{width:448,height:576},'4:3':{width:576,height:448},'9:16':{width:384,height:640},'16:9':{width:640,height:384},'2:3':{width:448,height:640},'3:2':{width:640,height:448}}[ratio]||{width:512,height:512};
   const localTarget=(config.localUrl||'http://127.0.0.1:8789').replace(/\\/+$/,'');
   await ensureLocalEngineServer(req, localTarget);

   task.onCancel = async () => {
    await cancelLocalEngineInference(req);
   };

   const targetModel=String(reqBody.model||config.selectedModel||'').trim();
   const isFastModel=/lcm|turbo|sdxs/i.test(targetModel);
   let reqSteps=parseInt(config.steps,10);
   if(!Number.isFinite(reqSteps)||reqSteps<4){
    reqSteps=isFastModel?4:15;
   }else if(!isFastModel&&reqSteps<12){
    reqSteps=15;
   }
   let reqCfg=parseFloat(config.cfgScale);
   if(!Number.isFinite(reqCfg)||reqCfg<=0){
    reqCfg=isFastModel?1.8:7.0;
   }else if(!isFastModel&&reqCfg<3.0){
    reqCfg=7.0;
   }
   let reqNeg=String(config.negativePrompt||'').trim();
   if(!reqNeg||reqNeg==='test neg'||reqNeg.length<8){
    reqNeg='bad anatomy, bad hands, lowres, text, watermark, deformed, blurry, missing fingers, extra limbs';
   }
   let promptForSd=text;
   if(/[\\u4e00-\\u9fa5]/.test(text)){
    promptForSd='masterpiece, best quality, ultra-detailed, highly detailed illustration, '+text;
   }
   let b64Image='';
   try {
    const sdRes=await fetch(localTarget+'/sdapi/v1/txt2img',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({
      prompt:promptForSd,
      negative_prompt:reqNeg,
      steps:reqSteps,
      cfg_scale:reqCfg,
      width:dims.width,
      height:dims.height,
      batch_size:1,
      model:targetModel
     }),
     signal:task.controller.signal
    });
    if(sdRes.ok){
     const sdData=await sdRes.json();
     if(Array.isArray(sdData?.images)&&sdData.images[0])b64Image=String(sdData.images[0]);
    }else{
     const errJson=await sdRes.json().catch(()=>null);
     const errMsg=errJson?.error||(await sdRes.text().catch(()=>''))||('HTTP '+sdRes.status);
     throw Error(errMsg);
    }
   } catch(err) {
    if(task.controller.signal.aborted) throw err;
    if(err.message&&!err.message.includes('fetch failed')&&!err.message.includes('ECONNREFUSED')){
     throw err;
    }
   }

   if(!b64Image){
    try{
     const oaiRes=await fetch(localTarget+'/v1/images/generations',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
       prompt:text,
       size:\`\${dims.width}x\${dims.height}\`,
       n:1,
       response_format:'b64_json'
      }),
      signal:task.controller.signal
     });
     if(!oaiRes.ok){
      const oaiErr=await oaiRes.text().catch(()=>'');
      throw Error(\`本地引擎返回 HTTP \${oaiRes.status}：\${oaiErr.slice(0,200)||'生成失败'}\`);
     }
     const oaiData=await oaiRes.json();
     b64Image=oaiData?.data?.[0]?.b64_json||'';
    }catch(err){
     if(task.controller.signal.aborted) throw err;
     if(!b64Image){
      if(err.message&&!err.message.includes('fetch failed')&&!err.message.includes('ECONNREFUSED')){
       throw err;
      }
      throw Error(\`未连接到本地 SD 引擎 (\${localTarget})。未检测到运行中的 SD 服务；如使用云端出图，请在图片生成设置中将接入来源切回「中转服务」\`);
     }
    }
   }

   if(!b64Image)throw Error('本地 SD 引擎未返回有效的图像数据');
   b64Image=b64Image.replace(/^data:image\\/[a-z]+;base64,/i,'');
   const format='png',mime='image/png',out={format,data:b64Image};
   try{
    out.historyId=saveImageHistory(req,{format,mime,data:b64Image,prompt:text,ratio,model:targetModel||config.selectedModel||'local/sd-cpp',resolution:\`\${dims.width}x\${dims.height}\`,source:reqBody.source});
   }catch(e){
    out.historyError='图片已生成，但未能存入当前角色卡历史';
   }
   return out;
  }

  // 云端 Relay Gemini 模式
  const key=readSecret(req.user.directories,secretName('image'));
  if(!key)throw Error('请先保存中转令牌');
  let effectiveModel=config.model;
  if(effectiveModel==='gemini-3.1-flash-image'){
   effectiveModel='gemini-3.1-flash-lite-image';
  }
  const generationConfig={responseModalities:['TEXT','IMAGE'],imageConfig:{aspectRatio:ratio}};
  if(!effectiveModel.startsWith('gemini-2.5-'))generationConfig.imageConfig.imageSize=config.resolution;
  const part={text};
  const upstream=await fetch(endpoint(config.base,effectiveModel),{
   method:'POST',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
   body:JSON.stringify({contents:[{role:'user',parts:[part]}],generationConfig}),
   signal:task.controller.signal,
   redirect:'error'
  });
  if(!upstream.ok){
   const detail=safeError(await boundedText(upstream),key);
   throw Error(\`中转返回 HTTP \${upstream.status}\`+(detail?'：'+detail:'，请检查网关或中转日志'));
  }
  const chunks=[];let count=0;
  for await(const chunk of upstream.body){
   count+=chunk.length;
   if(count>48*1024*1024){
    task.controller.abort();
    throw Error('上游返回超过 48 MiB 限制');
   }
   chunks.push(chunk);
  }
  const result=JSON.parse(Buffer.concat(chunks).toString());
  const blobs=decodePart(result,'image');
  const blob=blobs[0],mime=String(blob.mimeType||blob.mime_type).toLowerCase();
  const formats={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
  if(!formats[mime])throw Error('不支持的图片格式');
  const format=formats[mime],out={format,data:blob.data};
  try{
   out.historyId=saveImageHistory(req,{format,mime,data:blob.data,prompt:text,ratio,model:config.model,resolution:config.resolution,source:reqBody.source});
  }catch(error){
   out.historyError='图片已生成，但未能存入当前角色卡历史';
  }
  return out;
 }
}

const imageTaskQueue = new ImageTaskQueue();
`;

// 把队列类插入在 generate(req,res,kind) 前面，并改写 generate
if (!mediaSrc.includes('class ImageTaskQueue')) {
  const targetGenerateStart = 'async function generate(req,res,kind){';
  const newGenerate = `${queueClassDefinition}
async function generate(req,res,kind){
 if (kind === 'image') {
  return imageTaskQueue.enqueue(req, res);
 }
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),600000);
 const cancel=()=>{if(!res.writableEnded)controller.abort();};res.once('close',cancel);
 try{
  const config=readConfig(req,kind);
  const text=String(req.body.input||'').trim();
  if(!text||text.length>12000)return res.status(400).json({error:'文本为空或超过长度限制'});
  let savedSession,clipIndex,cacheKey;const voice=String(req.body.voice||config.voice),requestStyle=String(req.body.style||'').slice(0,500),style=requestStyle||config.style||'';
  if(req.body.sessionId){savedSession=sessionById(req,req.body.sessionId);if(savedSession.provider==='system')return res.status(400).json({error:'系统配音不能使用 API 生成入口'});if(savedSession.result.segments.some(x=>x.type==='dialogue'&&(['narrator','__unresolved__'].includes(x.speakerId)||x.identityEvidenceConflict||savedSession.result.speakers?.find(p=>p.id===x.speakerId)?.identityConflict)&&!x.reviewConfirmed))return res.status(400).json({error:'请先审核发言人待确认的台词，或明确确认按旁白音色朗读'});clipIndex=Number(req.body.segmentIndex);const segment=spokenSegments(savedSession.result)[clipIndex];if(!Number.isInteger(clipIndex)||!segment||segment.text.trim()!==text||(savedSession.voices[segment.speakerId]||'Kore')!==voice||clipStyle(segment)!==requestStyle)return res.status(400).json({error:'语音请求与保存的配音安排不一致，请先保存审核结果'});cacheKey=digest(JSON.stringify({version:2,text,voice,style,model:config.model,base:config.base}));
   const cached=readDatabase(req).audioCache?.[cacheKey];if(cached&&fs.existsSync(path.join(cardDirectory(req),cacheKey+'.audio'))){const audio=fs.readFileSync(path.join(cardDirectory(req),cacheKey+'.audio'));const db=readDatabase(req),record=db.sessions[savedSession.id];record.audio=(record.audio||[]).filter(x=>x.index!==clipIndex);record.audio.push({...cached,index:clipIndex,style:requestStyle});record.updatedAt=new Date().toISOString();writeDatabase(req,db);return res.type(cached.mime).set('Cache-Control','no-store').set('X-Xingzhan-Cache','hit').set('X-Xingzhan-Audio-Url',audioUrl(req,savedSession.id,clipIndex)).send(audio);}
  }
  const key=readSecret(req.user.directories,secretName(kind));
  if(!key)return res.status(400).json({error:'请先保存中转令牌'});
  const generationConfig={responseModalities:['AUDIO']};
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(voice))throw Error('音色名称格式不正确');
  generationConfig.speechConfig={voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}};
  const part={text};if(/^gemini-3\\.8-/i.test(config.model)&&style)part.speech_metadata={style};
  const upstream=await fetch(endpoint(config.base,config.model),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({contents:[{role:'user',parts:[part]}],generationConfig}),signal:controller.signal,redirect:'error'});
  if(!upstream.ok){const detail=safeError(await boundedText(upstream),key);return res.status(upstream.status>=400&&upstream.status<600?upstream.status:502).json({error:\`中转返回 HTTP \${upstream.status}\`+(detail?'：'+detail:'，入口未返回可识别的 JSON 错误，请检查网关或中转日志')});}
  const chunks=[];let count=0;for await(const chunk of upstream.body){count+=chunk.length;if(count>48*1024*1024){controller.abort();throw Error('上游返回超过 48 MiB 限制');}chunks.push(chunk);}
  const result=JSON.parse(Buffer.concat(chunks).toString());const blobs=decodePart(result,'audio');
  const audio=playableAudio(blobs);if(savedSession){atomicWrite(path.join(cardDirectory(req),cacheKey+'.audio'),audio.bytes);const db=readDatabase(req),record=db.sessions[savedSession.id],clip={key:cacheKey,index:clipIndex,mime:audio.mime,text,voice,style:requestStyle,model:config.model};db.audioCache??={};db.audioCache[cacheKey]=clip;record.audio=(record.audio||[]).filter(x=>x.index!==clipIndex);record.audio.push(clip);record.updatedAt=new Date().toISOString();writeDatabase(req,db);res.set('X-Xingzhan-Audio-Url',audioUrl(req,savedSession.id,clipIndex)).set('X-Xingzhan-Cache','new');}res.type(audio.mime).set('Cache-Control','no-store').send(audio.bytes);
 }catch(error){if(!res.destroyed&&!res.headersSent)res.status(controller.signal.aborted?504:502).json({error:controller.signal.aborted?'生成已取消或超时':error instanceof SyntaxError?'上游返回格式无效':String(error.message).slice(0,220)});}
 finally{clearTimeout(timer);res.off('close',cancel);}
}`;

  // 找到原来从 async function generate 到 const IMAGE_HISTORY_LIMIT 的整段代码
  const startIdx = mediaSrc.indexOf('async function generate(req,res,kind){');
  const endIdx = mediaSrc.indexOf('const IMAGE_HISTORY_LIMIT=200');
  if (startIdx !== -1 && endIdx !== -1) {
    mediaSrc = mediaSrc.slice(0, startIdx) + newGenerate + '\n' + mediaSrc.slice(endIdx);
  } else {
    throw new Error('Failed to locate generate function boundaries');
  }
}

// 1.5 增加路由注册
if (!mediaSrc.includes('/api/android/media/image-queue/status')) {
  const targetRoutePoint = "for(const kind of ['tts','image'])app.post('/api/android/media/generate-'+kind,(req,res)=>generate(req,res,kind));";
  const newRoutes = `  app.get('/api/android/media/image-queue/status', (req, res) => {
   try {
    res.set('Cache-Control', 'no-store').json(imageTaskQueue.getStatus());
   } catch (e) {
    res.status(500).json({ error: e.message });
   }
  });
  app.post('/api/android/media/image-queue/cancel', async (req, res) => {
   try {
    const result = await imageTaskQueue.cancelTask(req.body?.id, req);
    res.set('Cache-Control', 'no-store').json(result);
   } catch (e) {
    res.status(500).json({ error: e.message });
   }
  });
  ${targetRoutePoint}`;
  mediaSrc = mediaSrc.replace(targetRoutePoint, newRoutes);
}

fs.writeFileSync(androidMediaFile, mediaSrc, 'utf8');
console.log('✔ 已更新 android-media.mjs');

// ----------------------------------------------------
// Step 2: 处理 media.js (双端完全一致)
// ----------------------------------------------------
for (const mf of [pluginMediaFile, assetMediaFile]) {
  let mSrc = fs.readFileSync(mf, 'utf8');
  if (!mSrc.includes('getImageQueueStatus')) {
    mSrc = mSrc.replace(
      "export async function relayImage(prompt,ratio,signal,extra={}){return(await mediaRequest('generate-image',{prompt,aspect_ratio:ratio,...extra},signal)).json();}",
      `export async function relayImage(prompt,ratio,signal,extra={}){return(await mediaRequest('generate-image',{prompt,aspect_ratio:ratio,...extra},signal)).json();}\nexport async function getImageQueueStatus(){return(await mediaRequest('image-queue/status')).json();}\nexport async function cancelImageTask(taskId='all'){return(await mediaRequest('image-queue/cancel',{id:taskId})).json();}`
    );
    fs.writeFileSync(mf, mSrc, 'utf8');
    console.log('✔ 已更新 ' + path.basename(mf));
  }
}

console.log('=== Step 1 & 2 补丁写入完毕 ===');
