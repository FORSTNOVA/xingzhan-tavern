(async()=>{
 const {mediaRequest}=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
 const original=await mediaRequest('config/image').then(r=>r.json());
 const model=original.selectedModel;
 const short='anime girl, silver hair, blue kimono, moonlit garden';
 const long=Array(20).fill('silver hair, blue kimono, moonlit garden, detailed portrait').join(', ');
 let dialog,promptInput,oldPrompt;
 try{
  await mediaRequest('npu/start',{model});
  const [shortTokens,longTokens]=await Promise.all([
   mediaRequest('npu/tokenize',{prompt:short}).then(r=>r.json()),
   mediaRequest('npu/tokenize',{prompt:long}).then(r=>r.json()),
  ]);
  document.querySelector('#xingzhan-synthesis [data-open-image-dialog]')?.click();
  await new Promise(r=>setTimeout(r,600));
  dialog=document.querySelector('#xingzhan-image-dialog');
  promptInput=dialog?.querySelector('[data-image-prompt]');
  if(!promptInput)throw Error('image prompt field missing');
  oldPrompt=promptInput.value;
  promptInput.value=long;promptInput.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,750));
  const longUi={text:dialog.querySelector('[data-image-token-status]')?.textContent,state:dialog.querySelector('[data-image-token-status]')?.dataset.state};
  dialog.querySelector('[data-image-generate]')?.click();
  await new Promise(r=>setTimeout(r,450));
  const rejectedBeforeGenerate=dialog.querySelector('[data-image-status]')?.textContent||'';
  if(!rejectedBeforeGenerate.includes('已超限'))throw Error('long prompt was not rejected before generation: '+rejectedBeforeGenerate);
  promptInput.value=short;promptInput.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,750));
  const shortUi={text:dialog.querySelector('[data-image-token-status]')?.textContent,state:dialog.querySelector('[data-image-token-status]')?.dataset.state};
  const picker=dialog.querySelector('[data-image-quick-model]')?.value;
  const preset=document.querySelector('#xingzhan-synthesis [data-npu-standard-preset]');
  if(!preset)throw Error('NPU standard preset missing');
  preset.click();await new Promise(r=>setTimeout(r,450));
  const saved=await mediaRequest('config/image').then(r=>r.json());
  if(saved.selectedModel!==model)throw Error('saving NPU preset cleared selected model');
  return {shortCount:shortTokens.positive.count,longCount:longTokens.positive.count,limit:longTokens.positive.maxLength,longUi,rejectedBeforeGenerate,shortUi,picker,savedModel:saved.selectedModel,savedSteps:saved.steps,savedCfg:saved.cfgScale};
 }finally{
  if(promptInput){promptInput.value=oldPrompt||'';promptInput.dispatchEvent(new Event('input',{bubbles:true}));}
  await mediaRequest('npu/stop',{}).catch(()=>{});
 }
})()
