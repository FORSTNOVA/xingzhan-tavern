import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const data=JSON.parse(fs.readFileSync('artifacts/tts-probe/failed-whole-message-source.json','utf8')),c=await connect();
try{
 if(process.argv.includes('--start')){
  await c.evaluate(`(async()=>{for(let i=0;i<100&&!document.querySelector('#xingzhan-speech-dialog');i++)await new Promise(r=>setTimeout(r,100));const {extension_settings}=await import('/scripts/extensions.js');extension_settings.xingzhanSynthesis.speechProvider='system';const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js');await m.openSpeech(${JSON.stringify(data)});document.querySelector('[data-system-detect]').click();})()`);
  for(let i=0;i<40;i++){if(await c.evaluate(`!document.querySelector('[data-system-detect]').disabled`))break;await new Promise(r=>setTimeout(r,250));}
  await c.evaluate(`(()=>{const root=document.querySelector('#xingzhan-speech-dialog');if(root.querySelector('[data-system-analyze]').disabled)throw Error('系统引擎检测失败');root.querySelector('[data-system-analyze]').click();})()`);
 }
 const result=await c.evaluate(`(async()=>{const root=document.querySelector('#xingzhan-speech-dialog'),media=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js'),scope=${JSON.stringify(data.cardScope)},text=${JSON.stringify(data.text)},list=await media.listSpeechSessions(scope);let record;for(const item of list.sessions.filter(x=>x.provider==='system')){const saved=await media.loadSpeechSession(item.id,scope);if(saved.text===text&&saved.system.contextual){record=saved;break;}}return {busy:root.querySelector('[data-system-analyze]').disabled,status:root.querySelector('[data-system-status]').textContent,characters:text.length,recordId:record?.id,segments:record?.result.segments.length,bodyPreserved:record?record.result.segments.map(x=>x.text).join('')===text:false,roleCount:root.querySelectorAll('[data-system-role]').length,model:record?.result.model};})()`);
 fs.writeFileSync('artifacts/tts-probe/whole-message-live-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close();}
