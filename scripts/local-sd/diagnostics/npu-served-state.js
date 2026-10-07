(async()=>{
 const base='/scripts/extensions/third-party/xingzhan-synthesis/';
 const [index,media]=await Promise.all(['index.js','media.js'].map(async name=>({name,response:await fetch(base+name+'?t='+Date.now()).then(r=>({status:r.status,text:r.text()}))})));
 const ix=await index.response.text,md=await media.response.text;
 return {indexStatus:index.response.status,mediaStatus:media.response.status,indexNew:ix.includes('scheduleNpuTokenStatus'),mediaNew:md.includes('tokenizeNpuImagePrompt'),indexLength:ix.length,mediaLength:md.length};
})()
