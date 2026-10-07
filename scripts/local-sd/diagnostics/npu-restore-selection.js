(async()=>{
 const {mediaRequest}=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
 const model='AnythingV5-qnn2-28-8gen2';
 await mediaRequest('npu/select',{model});
 const cfg=await mediaRequest('config/image').then(r=>r.json());
 return {source:cfg.source,selectedModel:cfg.selectedModel,steps:cfg.steps,cfgScale:cfg.cfgScale};
})()
