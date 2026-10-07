import fs from 'node:fs';

// 1. Patch app/src/main/assets/android-media.mjs
let media = fs.readFileSync('app/src/main/assets/android-media.mjs', 'utf8').replace(/\r\n/g, '\n');

const targetErr = `     if (code !== 0 || !fs.existsSync(outPath)) {
      logLocalEngine('推理退出异常 (code=' + code + '): ' + stderr.slice(-200));
      return sendJson(500, { error: 'sd.cpp 退出错误 (' + code + '): ' + (stderr.slice(-200) || stdout.slice(-200)) });
     }`;

const replacementErr = `     if (code !== 0 || !fs.existsSync(outPath)) {
      logLocalEngine('推理退出异常 (code=' + code + '): ' + stderr.slice(-200));
      if (stderr.includes('get sd version from file failed')) {
       return sendJson(500, { error: '模型加载失败：当前选择的「' + path.basename(curModel) + '」为纯 UNet 降噪权重，缺少内置 CLIP（文本编码器）与 VAE（图像解码器）。请在下拉框中选择完整版模型（如 Counterfeit-V3.0）即可独立出图。' });
      }
      return sendJson(500, { error: 'sd.cpp 退出错误 (' + code + '): ' + (stderr.slice(-200) || stdout.slice(-200)) });
     }`;

if (media.includes(targetErr)) {
 media = media.replace(targetErr, replacementErr);
 fs.writeFileSync('app/src/main/assets/android-media.mjs', media, 'utf8');
 console.log('Updated error handling in android-media.mjs');
}

// 2. Patch plugins/xingzhan-synthesis/index.js & app/src/main/assets/xingzhan-synthesis-index.js
for (const file of ['plugins/xingzhan-synthesis/index.js', 'app/src/main/assets/xingzhan-synthesis-index.js']) {
 let idx = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

 // Update model dropdown labeling in syncWorkbenchModels
 const targetOptions = `     const opt = new Option('本地: ' + m.name + ' (' + m.sizeMb + 'MB)', 'local:' + m.name);`;
 const replacementOptions = `     const isGguf = m.name.toLowerCase().endsWith('.gguf');
     const label = '本地: ' + m.name + ' (' + m.sizeMb + 'MB · ' + (isGguf ? '纯UNet量化需外挂组件' : '完整组件独立出图') + ')';
     const opt = new Option(label, 'local:' + m.name);`;

 if (idx.includes(targetOptions)) {
  idx = idx.replace(targetOptions, replacementOptions);
 }

 // Update status on change
 const targetLocalChange = `       if (statusText) {
        statusText.textContent = '已切换为本地模型: ' + modelName;
        statusText.style.color = '#4caf50';
       }`;

 const replacementLocalChange = `       const isGguf = modelName.toLowerCase().endsWith('.gguf');
       if (statusText) {
        statusText.textContent = isGguf
         ? '已切换为「' + modelName + '」 (注：此为纯 UNet 模块，缺少内置 CLIP/VAE，独立出图建议选择 Counterfeit-V3.0)'
         : '已激活完整本地模型: ' + modelName + ' (含 CLIP+UNet+VAE，可独立离线出图)';
        statusText.style.color = isGguf ? '#ff9800' : '#4caf50';
       }`;

 if (idx.includes(targetLocalChange)) {
  idx = idx.replace(targetLocalChange, replacementLocalChange);
 }

 // Update generateImage status to show active model name
 const targetGenStart = `  setGenerating(true);setAllStatus('正在生成图片…');`;
 const replacementGenStart = `  const quickSel = activeRoot.querySelector('[data-image-quick-model]');
  const activeModelLabel = quickSel ? quickSel.options[quickSel.selectedIndex]?.text || '' : '';
  setGenerating(true);
  setAllStatus('正在使用【' + (activeModelLabel || '当前配置模型') + '】生成图片…（本地离线推理通常需2~3分钟，请耐心等待）');`;

 if (idx.includes(targetGenStart)) {
  idx = idx.replace(targetGenStart, replacementGenStart);
 }

 fs.writeFileSync(file, idx, 'utf8');
 console.log('Updated ' + file);
}
