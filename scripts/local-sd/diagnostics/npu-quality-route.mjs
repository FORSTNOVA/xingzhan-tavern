import fs from 'node:fs';
import path from 'node:path';
import {connect} from '../../webview-cdp.mjs';

const c=await connect();
const ratio=process.argv[2]||'3:4';
const steps=Number(process.argv[3]||20),cfg=Number(process.argv[4]||7);
if(!['1:1','3:4','4:3'].includes(ratio))throw Error('ratio must be 1:1, 3:4, or 4:3');
if(!Number.isFinite(steps)||!Number.isFinite(cfg))throw Error('invalid steps or CFG');
try {
  const result=await c.evaluate(`(async()=>{
    const {mediaRequest}=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
    const original=await mediaRequest('config/image').then(r=>r.json());
    let started=false;
    try {
      await mediaRequest('config/image',{steps:${steps},cfgScale:${cfg}});
      await mediaRequest('npu/start',{model:original.selectedModel});started=true;
      const response=await mediaRequest('generate-image',{
        prompt:'anime portrait, a calm girl with silver hair wearing a blue kimono, moonlit garden, detailed eyes, high quality',
        aspect_ratio:${JSON.stringify(ratio)},scopeId:'manual',scopeLabel:'NPU quality diagnostic',source:'diagnostic',
      });
      const image=await response.json();
      const status=await mediaRequest('npu/status').then(r=>r.json());
      return {ok:true,image:{data:image.data,width:image.width,height:image.height,seed:image.seed,historyId:image.historyId},status:{resolution:status.resolution,modelName:status.modelName,patchLogs:status.logs.filter(x=>/patch|启动模型|切换 NPU 分辨率/i.test(x)).slice(-12),logs:status.logs.slice(-12)}};
    }catch(error){
      const status=await mediaRequest('npu/status').then(r=>r.json()).catch(()=>({}));
      return {ok:false,error:String(error.message||error),status:{resolution:status.resolution,modelName:status.modelName,logs:(status.logs||[]).slice(-25)}};
    }finally{
      await mediaRequest('config/image',{steps:original.steps,cfgScale:original.cfgScale}).catch(()=>{});
      if(started)await mediaRequest('npu/stop',{}).catch(()=>{});
    }
  })()`);
  const dir=path.resolve('artifacts/local-npu-quality');fs.mkdirSync(dir,{recursive:true});
  if(result.image?.data){
    const file=path.join(dir,'route-patched-'+result.image.width+'x'+result.image.height+'-'+steps+'-cfg'+cfg+'.png');
    fs.writeFileSync(file,Buffer.from(result.image.data,'base64'));
    result.image={...result.image,file,bytes:fs.statSync(file).size};
    delete result.image.data;
  }
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=1;
}finally{c.close();}
