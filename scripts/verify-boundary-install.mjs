import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {connect} from './webview-cdp.mjs';
const c=await connect(),file='artifacts/tts-evaluation/pre-boundary-install-state.json';
try{
 if(process.argv.includes('--save')){
  const state=await c.evaluate(`(async()=>{const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');return {text:document.querySelector('[data-speech-text]')?.value||null,scope:m.currentSpeechScope()};})()`);
  fs.writeFileSync(file,JSON.stringify(state));console.log({saved:!!state.text,characters:state.text?.length});
 }else{
  const hash=createHash('sha256').update(fs.readFileSync('app/src/main/assets/android-media.mjs')).digest('hex');
  const info=await c.evaluate(`(async()=>{const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');const config=await(await m.mediaRequest('config/analysis')).json();return {revision:config.serverRevision,budgetSupported:config.analysisCallLimitSupported};})()`);
  if(info.revision!==hash)throw Error('Installed backend revision does not match source');
  if(!process.env.WEBVIEW_CDP_URL&&fs.existsSync(file)){
   const state=JSON.parse(fs.readFileSync(file));if(state.text)await c.evaluate(`(async()=>{const s=${JSON.stringify(state)},m=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js');await m.openSpeech({text:s.text,scope:'full',cardScope:s.scope});return true;})()`);
  }
  console.log({revisionMatched:true,budgetSupported:info.budgetSupported,realCalls:0});
 }
}finally{c.close();}
