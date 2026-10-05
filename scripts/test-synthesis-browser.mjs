import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const c=await connect();try{
 const result=await c.evaluate(`(async()=>{
 const assert=(ok,msg)=>{if(!ok)throw Error(msg);};const passed=[];
 assert(document.querySelector('#xingzhan-synthesis'),'独立面板未加载');passed.push('独立插件注册并加载面板');
 assert(!document.querySelector('#tts_provider option[value="星栈 Gemini TTS"]')&&!document.querySelector('#sd_google_api option[value="xingzhan"]')&&!document.querySelector('#xingzhan-image-config'),'官方面板仍有旧入口');passed.push('官方 TTS 与生图面板不含旧入口');
 const official=await Promise.all(['/scripts/extensions/tts/index.js','/scripts/extensions/stable-diffusion/index.js'].map(p=>fetch(p).then(r=>r.text())));assert(official.every(text=>!text.includes('xingzhan-media.js')&&!text.includes('XingzhanTtsProvider')),'官方代码仍引用合成扩展');passed.push('官方扩展源码无合成插件依赖');
 const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');const tts=await(await m.mediaRequest('config/tts')).json(),image=await(await m.mediaRequest('config/image')).json(),analysis=await(await m.mediaRequest('config/analysis')).json();assert(!('key' in tts)&&!('key' in image)&&!('key' in analysis),'令牌回显');assert(document.querySelector('#xingzhan-synthesis [data-kind="tts"] [data-field="model"]').value===tts.model,'语音模型未加载');assert(document.querySelector('#xingzhan-synthesis [data-kind="image"] [data-field="model"]').value===image.model,'图片模型未加载');assert(document.querySelector('#xingzhan-synthesis [data-kind="analysis"] [data-field="model"]').value===analysis.model,'分析模型未加载');passed.push('语音、图片与文本分析配置加载，令牌不回显');
 const original=window.fetch;let calls=[],cancelled=false;window.fetch=async(...args)=>{
 if(String(args[0]).includes('/api/android/media/generate-image')){const body=JSON.parse(args[1].body);calls.push(body);if(body.prompt==='cancel fixture')await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,4000);args[1].signal.addEventListener('abort',()=>{cancelled=true;clearTimeout(timer);reject(new DOMException('cancelled','AbortError'));},{once:true});});return new Response(JSON.stringify({format:'png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKZsAAAAASUVORK5CYII='}),{headers:{'Content-Type':'application/json'}});}return original.apply(window,args);};
 try{
 const plugin=await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js');const url=await plugin.generateImage('standalone image fixture','16:9');assert(url&&(await fetch(url)).ok,'独立生图未保存');const img=document.querySelector('#xingzhan-synthesis [data-image-preview]');await img.decode();assert(img.naturalWidth===1&&!img.hidden,'图片预览失败');assert(calls.length===1&&calls[0].aspect_ratio==='16:9','生图参数错误');passed.push('独立生成流程正确传参、保存并显示预览');
 const request=plugin.generateImage('cancel fixture','1:1');setTimeout(()=>document.querySelector('#xingzhan-synthesis [data-image-stop]').click(),100);await request;assert(cancelled&&document.querySelector('#xingzhan-synthesis [data-image-status]').textContent==='已停止生成','停止未取消请求');passed.push('独立生图停止请求，无重试');
 await plugin.generateImage('','1:1');assert(calls.length===2,'空输入发起请求');passed.push('空图片描述不请求生成');
 return {passed,tts:{model:tts.model,hasKey:tts.hasKey},image:{model:image.model,hasKey:image.hasKey},analysis:{model:analysis.model,hasKey:analysis.hasKey},upstream:'stubbed; no real generation calls'};
 }finally{window.fetch=original;const panel=document.querySelector('#xingzhan-synthesis');panel.querySelector('[data-image-preview]').hidden=true;panel.querySelector('[data-image-preview]').removeAttribute('src');panel.querySelector('[data-image-link]').hidden=true;panel.querySelector('[data-image-link]').removeAttribute('href');panel.querySelector('[data-image-status]').textContent='';}
 })()`);
 assert.ok(result.passed.length===7);fs.writeFileSync('artifacts/relay/synthesis-'+(process.argv.includes('--phone')?'phone':'emulator')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close();}
