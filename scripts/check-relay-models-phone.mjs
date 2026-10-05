import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();try{
const result=await c.evaluate(`(async()=>{const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');const result={};for(const kind of ['tts','image']){try{result[kind]=await(await m.mediaRequest('diagnostics/'+kind)).json();}catch(e){result[kind]={error:e.message};}}return result;})()`);
fs.writeFileSync('artifacts/relay/phone-model-diagnostics.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close();}

