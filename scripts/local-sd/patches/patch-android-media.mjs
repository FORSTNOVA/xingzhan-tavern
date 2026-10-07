import fs from 'node:fs';

const file = 'app/src/main/assets/android-media.mjs';
let content = fs.readFileSync(file, 'utf8');

// 1. Pass targetModel to txt2img
const oldTxt2Img = `   const localTarget=(config.localUrl||'http://127.0.0.1:8789').replace(/\\/+$/,'');
   let b64Image='';
   try{
    const sdRes=await fetch(localTarget+'/sdapi/v1/txt2img',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({
      prompt:text,
      negative_prompt:config.negativePrompt||'bad anatomy, bad hands, lowres, text, watermark',
      steps:config.steps||8,
      cfg_scale:config.cfgScale||1.8,
      width:dims.width,
      height:dims.height,
      batch_size:1
     }),`;

const newTxt2Img = `   const localTarget=(config.localUrl||'http://127.0.0.1:8789').replace(/\\/+$/,'');
   const targetModel=String(req.body.model||config.selectedModel||'').trim();
   let b64Image='';
   try{
    const sdRes=await fetch(localTarget+'/sdapi/v1/txt2img',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({
      prompt:text,
      negative_prompt:config.negativePrompt||'bad anatomy, bad hands, lowres, text, watermark',
      steps:config.steps||8,
      cfg_scale:config.cfgScale||1.8,
      width:dims.width,
      height:dims.height,
      batch_size:1,
      model:targetModel
     }),`;

// 2. Save actual model in image history
const oldSaveHistory = `out.historyId=saveImageHistory(req,{format,mime,data:b64Image,prompt:text,ratio,model:'local/sd-community-lcm',resolution:\`\${dims.width}x\${dims.height}\`,source:req.body.source});`;
const newSaveHistory = `out.historyId=saveImageHistory(req,{format,mime,data:b64Image,prompt:text,ratio,model:targetModel||config.selectedModel||'local/sd-cpp',resolution:\`\${dims.width}x\${dims.height}\`,source:req.body.source});`;

// 3. findLocalModel enhancement
const oldFindModel = `function findLocalModel(sdDir, preferredName) {
 const all = scanAllLocalModels(sdDir);
 if (preferredName) {
  const match = all.find(m => m.name === preferredName || m.path === preferredName);
  if (match) return match.path;
 }
 return all.length > 0 ? all[0].path : null;
}`;

const newFindModel = `function findLocalModel(sdDir, preferredName) {
 const all = scanAllLocalModels(sdDir);
 if (preferredName) {
  const match = all.find(m => m.name === preferredName || m.path === preferredName || path.basename(m.path) === preferredName);
  if (match) return match.path;
 }
 return all.length > 0 ? all[0].path : null;
}`;

// 4. Dedicated model switch route
const oldStopRoute = `  app.post('/api/android/media/local-engine/stop', async (req, res) => {
   try {
    stopLocalEngineServer();
    const config = readConfig(req, 'image');
    const portMatch = (config.localUrl || 'http://127.0.0.1:8789').match(/:(\\d+)/);
    const port = portMatch ? parseInt(portMatch[1], 10) : 8789;
    const status = await getLocalEngineStatus(req, port);
    res.json({ success: true, ...status });
   } catch (e) {
    res.status(500).json({ error: e.message });
   }
  });`;

const newStopRoute = `${oldStopRoute}
  app.post('/api/android/media/local-engine/model', async (req, res) => {
   try {
    const chosen = String(req.body.model || '').trim();
    const config = readConfig(req, 'image');
    config.selectedModel = chosen;
    const file = path.join(req.user.directories.root, 'xingzhan-media.json');
    let data = {};
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    data.image = config;
    atomicWrite(file, Buffer.from(JSON.stringify(data, null, 2)));
    logLocalEngine('生图模型已主动切换为: ' + (chosen || '自动检测'));
    const portMatch = (config.localUrl || 'http://127.0.0.1:8789').match(/:(\\d+)/);
    const port = portMatch ? parseInt(portMatch[1], 10) : 8789;
    const status = await getLocalEngineStatus(req, port);
    res.json({ success: true, ...status });
   } catch (e) {
    res.status(500).json({ error: e.message });
   }
  });`;

// Normalize content line endings for replacement
let normalized = content.replace(/\r\n/g, '\n');

if (!normalized.includes(oldTxt2Img)) throw new Error('oldTxt2Img not found');
if (!normalized.includes(oldSaveHistory)) throw new Error('oldSaveHistory not found');
if (!normalized.includes(oldFindModel)) throw new Error('oldFindModel not found');
if (!normalized.includes(oldStopRoute)) throw new Error('oldStopRoute not found');

normalized = normalized.replace(oldTxt2Img, newTxt2Img);
normalized = normalized.replace(oldSaveHistory, newSaveHistory);
normalized = normalized.replace(oldFindModel, newFindModel);
normalized = normalized.replace(oldStopRoute, newStopRoute);

fs.writeFileSync(file, normalized, 'utf8');
console.log('Successfully patched android-media.mjs!');
