import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const file='artifacts/tts-probe/real-analysis-system-playback.json',saved=JSON.parse(fs.readFileSync(file)),c=await connect();
try{
 const result=await c.evaluate(`(async()=>{const saved=${JSON.stringify(saved)},m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');const r=await m.loadSpeechSession(saved.recordId,saved.scope);if(r.audio.length!==4)throw Error('重启后音频丢失');for(const clip of r.audio){const bytes=new Uint8Array(await(await fetch(clip.url)).arrayBuffer());if(String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||bytes.length<=44)throw Error('重启后的音频不可用');}return {appRestartRestore:true,audioCount:r.audio.length,bodyPreserved:r.result.segments.map(x=>x.text).join('')===r.text,realCalls:0};})()`);
 assert.equal(result.bodyPreserved,true);Object.assign(saved,result);fs.writeFileSync(file,JSON.stringify(saved,null,2));console.log(JSON.stringify(result));
}finally{c.close();}
