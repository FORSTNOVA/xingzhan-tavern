import {connect} from './webview-cdp.mjs';
const c=await connect();try{
console.log(await c.evaluate(`(async()=>{const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');const models={tts:'gemini-3.8-flash-lite-tts',image:'gemini-3.1-flash-lite-image'};const result={};for(const kind of ['tts','image']){const body={model:models[kind]};if(kind==='image')body.resolution='1K';const config=await(await m.mediaRequest('config/'+kind,body)).json();const form=document.querySelector('.xingzhan-media-settings[data-kind="'+kind+'"]');if(form){form.querySelector('[data-field="model"]').value=config.model;if(kind==='image')form.querySelector('[data-field="resolution"]').value=config.resolution;}result[kind]={model:config.model,hasKey:config.hasKey};}return result;})()`));
}finally{c.close();}

