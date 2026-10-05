import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:18787';const csrf=await fetch(base+'/csrf-token');const token=(await csrf.json()).token;const cookie=csrf.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const headers={'Content-Type':'application/json','X-CSRF-Token':token,Cookie:cookie};const passed=[];
async function call(route,body){return fetch(base+'/api/android/media/'+route,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});}
async function save(kind,config){const r=await call('config/'+kind,config);assert.equal(r.status,200,await r.clone().text());return r.json();}
const config={base:'http://10.0.2.2:18891',key:'relay-test-only',channel:'AI Studio'};
await save('tts',{...config,model:'gemini-3.1-flash-tts-preview',voice:'Kore',style:'自然朗读'});
let view=await(await call('config/tts')).json();assert.equal(view.hasKey,true);assert.equal(view.key,undefined);passed.push('配置保存和令牌不回显');
let result=await call('generate-tts',{input:'模拟器语音测试',voice:'Kore'});assert.equal(result.status,200,await result.clone().text());const audio=Buffer.from(await result.arrayBuffer());assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.readUInt32LE(24),24000);assert.equal(audio.length,48044);fs.mkdirSync('artifacts/relay',{recursive:true});fs.writeFileSync('artifacts/relay/emulator-tts.wav',audio);passed.push('模拟器后端 TTS 原生请求与 PCM 转 WAV');
await save('image',{...config,model:'gemini-3.1-flash-image',resolution:'1K'});
result=await call('generate-image',{prompt:'生成一个图标',aspect_ratio:'1:1'});assert.equal(result.status,200);const image=await result.json();assert.equal(image.format,'png');assert.equal(Buffer.from(image.data,'base64').subarray(1,4).toString(),'PNG');passed.push('模拟器后端 Gemini 图片解码');
await save('image',{channel:'Vertex AI'});result=await call('generate-image',{prompt:'Vertex 渠道模拟',aspect_ratio:'16:9'});assert.equal(result.status,200);passed.push('Vertex 配置复用原生 Gemini 图片请求');
result=await call('generate-tts',{input:''});assert.equal(result.status,400);passed.push('空输入拒绝');
result=await call('config/image',{base:'http://example.com',model:'gemini-image'});assert.equal(result.status,400);passed.push('非 HTTPS 外部地址拒绝');
result=await fetch(base+'/api/android/media/generate-image',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({prompt:'bad csrf'})});assert.equal(result.status,403);passed.push('缺少 CSRF 请求拒绝');
await save('tts',{model:'fail-401'});result=await call('generate-tts',{input:'报错测试'});assert.equal(result.status,401);assert.ok(!(await result.text()).includes('relay-test-only'));passed.push('上游 401 状态保留且错误不泄露令牌');
await save('tts',{model:'missing-data'});result=await call('generate-tts',{input:'无音频测试'});assert.equal(result.status,502);passed.push('只有文本没有音频时明确报错');
await save('tts',{model:'slow-response'});const controller=new AbortController();const request=fetch(base+'/api/android/media/generate-tts',{method:'POST',headers,body:JSON.stringify({input:'取消测试'}),signal:controller.signal});setTimeout(()=>controller.abort(),200);await assert.rejects(request);passed.push('客户端取消请求');
await new Promise(r=>setTimeout(r,500));assert.ok(JSON.parse(fs.readFileSync('artifacts/relay/mock-cancellations.json')).some(p=>p.includes('slow-response')));passed.push('取消传递至上游，停止等待生成');
await save('tts',{model:'gemini-3.1-flash-tts-preview'});await save('image',{model:'gemini-3.1-flash-image',channel:'AI Studio'});
const requests=JSON.parse(fs.readFileSync('artifacts/relay/mock-requests.json'));assert.ok(requests.every(r=>r.authorized));assert.ok(requests.some(r=>r.body.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName==='Kore'));assert.ok(requests.some(r=>r.body.generationConfig?.imageConfig?.aspectRatio==='16:9'));passed.push('模拟上游收到正确鉴权、音色和图片比例');
fs.writeFileSync('artifacts/relay/emulator-backend.json',JSON.stringify({passed},null,2));console.log(JSON.stringify({passed},null,2));
