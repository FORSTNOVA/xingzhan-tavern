import fs from 'node:fs';
import path from 'node:path';
import {connect} from '../../webview-cdp.mjs';

const outputDir = path.resolve('artifacts/local-npu-quality');
fs.mkdirSync(outputDir, {recursive:true});
const c = await connect();
try {
  const rows = await c.evaluate(`(async()=>{
    const {mediaRequest,currentSpeechScope}=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
    const scope=currentSpeechScope().id;
    const history=await mediaRequest('image-history?scope='+encodeURIComponent(scope)).then(r=>r.json());
    const images=(history.images||[]).filter(x=>String(x.model||'').includes('Local Dream QNN')).slice(0,4);
    const out=[];
    for(const item of images){
      const response=await fetch(item.url);
      if(!response.ok)throw Error('history file HTTP '+response.status);
      const blob=await response.blob();
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
      out.push({id:item.id,width:item.resolution,ratio:item.ratio,createdAt:item.createdAt,data});
    }
    return out;
  })()`);
  for (let i=0;i<rows.length;i++) {
    const file=path.join(outputDir,`history-${i+1}-${rows[i].ratio.replace(':','x')}.png`);
    fs.writeFileSync(file,Buffer.from(rows[i].data,'base64'));
    console.log(JSON.stringify({file,bytes:fs.statSync(file).size,id:rows[i].id,width:rows[i].width,ratio:rows[i].ratio,createdAt:rows[i].createdAt}));
  }
} finally { c.close(); }
