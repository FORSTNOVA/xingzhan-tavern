import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {connect} from './webview-cdp.mjs';
fs.mkdirSync('artifacts/chat-ui',{recursive:true});
const retryAvatar=process.argv[2]==='retry'?JSON.parse(fs.readFileSync('artifacts/chat-ui/result.json','utf8')).avatar:null;
const result={startedAt:new Date().toISOString(),scope:'Actual Tavern chat UI; mock upstream; USB charging; no screen-off commands',checks:[],requests:[]};
const save=()=>fs.writeFileSync('artifacts/chat-ui/result.json',JSON.stringify(result,null,2));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const adb=(...args)=>execFileSync('C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s','ca168055',...args],{encoding:'utf8',timeout:15000}).trim();
const base='http://127.0.0.1:19787';
const csrf=await fetch(base+'/csrf-token');const {token}=await csrf.json();const cookie=csrf.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const headers={'Content-Type':'application/json','X-CSRF-Token':token,Cookie:cookie};
const post=async(url,body)=>{const res=await fetch(base+url,{method:'POST',headers,body:JSON.stringify(body)});if(!res.ok)throw new Error(`${url}: ${res.status}`);return res.json();};
const mock=http.createServer(async(req,res)=>{
 if(req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({object:'list',data:[{id:'apk-ui-probe',object:'model'}]}));return;}
 let text='';for await(const part of req)text+=part;
 const body=JSON.parse(text);const scenario=['NORMAL','STREAM','CANCEL','BACKGROUND'].find(id=>JSON.stringify(body.messages?.filter(m=>m.role==='user').at(-1)).includes('APK_UI_'+id));
 const record={scenario,stream:!!body.stream,sent:0,done:false,startedAt:Date.now()};result.requests.push(record);save();
 if(!scenario){res.writeHead(400);res.end('Unknown test scenario');return;}
 if(!body.stream){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:'普通回复验证成功。'},finish_reason:'stop'}]}));record.done=true;save();return;}
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 const n=scenario==='STREAM'?8:scenario==='BACKGROUND'?45:60;
 const timer=setInterval(()=>{record.sent++;const content=`${scenario}:${String(record.sent).padStart(2,'0')} `;res.write(`data: ${JSON.stringify({choices:[{index:0,delta:{content},finish_reason:null}]})}\n\n`);if(record.sent===n){clearInterval(timer);record.done=true;res.end('data: [DONE]\n\n');save();}},scenario==='STREAM'?350:1000);
 res.on('close',()=>{clearInterval(timer);record.closedAt=Date.now();record.aborted=!record.done;save();});
});
await new Promise(r=>mock.listen(18888,'127.0.0.1',r));adb('reverse','tcp:18888','tcp:18888');
const c=await connect();let root;let backup;let avatar;
const keys=['chat_completion_source','custom_url','custom_model','stream_openai','custom_include_body','custom_exclude_body','custom_include_headers'];
async function state(){return c.evaluate(`(async()=>{const m=await import('/script.js');const ctx=SillyTavern.getContext();return {busy:m.is_send_press,processor:!!ctx.streamingProcessor,sendReady:$('#send_but').css('display')!=='none',status:ctx.onlineStatus,chatId:ctx.chatId,characterId:ctx.characterId,messages:ctx.chat.map(x=>({name:x.name,is_user:x.is_user,mes:x.mes})),dom:[...document.querySelectorAll('#chat .mes')].map(x=>({user:x.getAttribute('is_user'),text:x.querySelector('.mes_text')?.innerText})),visibility:document.visibilityState}})()`,root);}
async function until(predicate,seconds=20){let value;for(let i=0;i<seconds*4;i++){value=await state();if(predicate(value))return value;await wait(250);}throw new Error('UI timeout: '+JSON.stringify({busy:value?.busy,status:value?.status,messageCount:value?.messages?.length}));}
async function send(id,stream){
 await until(s=>!s.busy&&!s.processor&&s.sendReady);await wait(1500);
 await c.evaluate(`(async()=>{const {oai_settings}=await import('/scripts/openai.js');oai_settings.stream_openai=${stream};$('#stream_toggle').prop('checked',${stream});$('#send_textarea').val('APK_UI_${id}').trigger('input');$('#send_but').trigger('click');return true;})()`,root);
 return until(s=>s.messages.some(m=>m.is_user&&m.mes==='APK_UI_'+id));
}
try{
 for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault&&await c.evaluate(`location.href.startsWith('http://127.0.0.1:8787/')`,ctx.id))root=ctx.id;
 if(!root)throw new Error('Root WebView missing');
 backup=await c.evaluate(`(async()=>{const m=await import('/script.js');const {oai_settings}=await import('/scripts/openai.js');const ctx=SillyTavern.getContext();return {mainApi:m.main_api,settings:Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,oai_settings[k]])),characterId:ctx.characterId,chatId:ctx.chatId};})()`,root);
 fs.writeFileSync('artifacts/chat-ui/connection-backup.json',JSON.stringify(backup,null,2));
 // Refuse every generation request that does not explicitly target the local mock.
 await c.evaluate(`(()=>{window.__uiProbeOriginalFetch=window.fetch;window.fetch=function(input,init){const url=typeof input==='string'?input:input.url;if(url.includes('/generate')){try{const body=JSON.parse(init?.body||'{}');if(body.chat_completion_source!=='custom'||body.custom_url!=='http://127.0.0.1:18888/v1')return Promise.reject(new Error('UI test only permits the local mock'));}catch(e){return Promise.reject(e);}}return window.__uiProbeOriginalFetch.apply(this,arguments);};return true;})()`,root);
 const name='APK 聊天流程验证 '+Date.now();
 const card={spec:'chara_card_v2',spec_version:'2.0',data:{name,description:'独立的本地 APK 聊天验证角色。',personality:'',scenario:'',first_mes:'这是独立测试聊天，使用本地模拟模型，不调用收费 API。',mes_example:'',creator_notes:'自动验证创建。',system_prompt:'',post_history_instructions:'',alternate_greetings:[],tags:['APK验证'],creator:'local-probe',character_version:'1',extensions:{}}};
 if(retryAvatar){avatar=retryAvatar;}else{
  const form=new FormData();form.append('file_type','json');form.append('avatar',new Blob([JSON.stringify(card)],{type:'application/json'}),'apk-ui-probe.json');
  const imported=await fetch(base+'/api/characters/import',{method:'POST',headers:{'X-CSRF-Token':token,Cookie:cookie},body:form});if(!imported.ok)throw new Error('Import failed '+imported.status);avatar=(await imported.json()).file_name+'.png';
 }result.avatar=avatar;
 await c.evaluate(`(async()=>{const m=await import('/script.js');await m.getCharacters();const id=m.characters.findIndex(ch=>ch.avatar===${JSON.stringify(avatar)});if(id<0)throw new Error('Test character missing');await m.selectCharacterById(id,{switchMenu:false});const {oai_settings}=await import('/scripts/openai.js');Object.assign(oai_settings,{chat_completion_source:'custom',custom_url:'http://127.0.0.1:18888/v1',custom_model:'apk-ui-probe',stream_openai:false,custom_include_body:'',custom_exclude_body:'',custom_include_headers:''});$('#custom_api_url_text').val(oai_settings.custom_url);$('#custom_model_id').val(oai_settings.custom_model);$('#chat_completion_source').val('custom');$('#main_api').val('openai');m.changeMainAPI('openai');$('#api_button_openai').trigger('click');return true;})()`,root);
 await until(s=>s.status&&s.status!=='no_connection',20);
 await send('NORMAL',false);let s=await until(s=>!s.busy&&s.messages.at(-1)?.mes.includes('普通回复验证成功'));
 assert.ok(s.dom.at(-1).text.includes('普通回复验证成功'));result.checks.push({name:'normal reply rendered',passed:true});save();
 await send('STREAM',true);s=await until(s=>s.busy&&s.messages.at(-1)?.mes.includes('STREAM:01'));
 result.partialStream=s.messages.at(-1).mes;
 s=await until(s=>!s.busy&&s.messages.at(-1)?.mes.includes('STREAM:08'));
 assert.ok(s.dom.at(-1).text.includes('STREAM:08'));result.checks.push({name:'partial and completed streaming reply rendered',passed:true});save();
 await send('CANCEL',true);await until(s=>s.messages.at(-1)?.mes.includes('CANCEL:03'));
 await c.evaluate(`$('#mes_stop').trigger('click');true`,root);await until(s=>!s.busy);await wait(1500);
 const cancelled=result.requests.find(r=>r.scenario==='CANCEL');assert.ok(cancelled.aborted && cancelled.sent<60);result.checks.push({name:'stop button cancels upstream and leaves a partial reply',passed:true,sent:cancelled.sent});save();
 await send('BACKGROUND',true);await until(s=>s.messages.at(-1)?.mes.includes('BACKGROUND:04'));
 const taskId=adb('shell','dumpsys','activity','activities','cn.jiuguan.probe').match(/ActivityRecord\{[^\n]*cn\.jiuguan\.probe\/\.MainActivity t(\d+)/)?.[1];if(!taskId)throw new Error('Task ID missing');
 adb('shell','input','keyevent','KEYCODE_HOME');result.backgroundStartedAt=Date.now();
 await wait(20000);result.backgroundPower=adb('shell','dumpsys','power').split('\n').find(l=>l.includes('mWakefulness='))?.trim();
 await wait(25000);result.backgroundFinishedAt=Date.now();adb('shell','am','task','focus',taskId);
 s=await until(s=>!s.busy&&s.messages.at(-1)?.mes.includes('BACKGROUND:45'),20);
 assert.ok(s.dom.at(-1).text.includes('BACKGROUND:45'));assert.equal(result.requests.find(r=>r.scenario==='BACKGROUND').sent,45);
 result.checks.push({name:'awake background chat generation completes and renders on return',passed:true});
 await c.evaluate(`SillyTavern.getContext().saveChat()`,root);await wait(1000);
 s=await state();result.chatId=s.chatId;const stored=await post('/api/chats/get',{avatar_url:avatar,file_name:s.chatId});
 fs.writeFileSync('artifacts/chat-ui/saved-chat.json',JSON.stringify(stored,null,2));
 assert.ok(stored.some(m=>m.mes?.includes('普通回复验证成功')));assert.ok(stored.some(m=>m.mes?.includes('BACKGROUND:45')));
 result.checks.push({name:'normal, streaming and background replies saved to actual chat file',passed:true});
 result.finalState=s;result.passed=true;save();
}catch(e){result.error=String(e);save();console.log(JSON.stringify({error:result.error}));}
finally{
 try{
  if(backup){await c.evaluate(`(async()=>{const ctx=SillyTavern.getContext();await ctx.stopGeneration();const {oai_settings}=await import('/scripts/openai.js');const m=await import('/script.js');Object.assign(oai_settings,${JSON.stringify(backup.settings)});$('#main_api').val(${JSON.stringify(backup.mainApi)});m.changeMainAPI(${JSON.stringify(backup.mainApi)});$('#custom_api_url_text').val(oai_settings.custom_url);$('#custom_model_id').val(oai_settings.custom_model);$('#chat_completion_source').val(oai_settings.chat_completion_source);$('#stream_toggle').prop('checked',oai_settings.stream_openai);m.saveSettingsDebounced();if(window.__uiProbeOriginalFetch){window.fetch=window.__uiProbeOriginalFetch;delete window.__uiProbeOriginalFetch;}return true;})()`,root);await wait(2000);
   const restored=await c.evaluate(`(async()=>{const m=await import('/script.js');const {oai_settings}=await import('/scripts/openai.js');return {mainApi:m.main_api,settings:Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,oai_settings[k]]))};})()`,root);
   result.settingsRestored=restored.mainApi===backup.mainApi&&JSON.stringify(restored.settings)===JSON.stringify(backup.settings);
  }
 }catch(e){result.restoreError=String(e);}
 result.completedAt=new Date().toISOString();save();c.close();mock.closeAllConnections();mock.close();
}
console.log(JSON.stringify({passed:result.passed,checks:result.checks,settingsRestored:result.settingsRestored,error:result.error,restoreError:result.restoreError,avatar:result.avatar}));
if(!result.passed || !result.settingsRestored)process.exitCode=1;
