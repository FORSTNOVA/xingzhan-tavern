import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
fs.mkdirSync('artifacts/theme',{recursive:true});
const c=await connect();const report={startedAt:new Date().toISOString(),samples:[],scope:'Actual ST long-chat reload and renderer; generated fixture only; no model calls'};
let root;let original;
try{
 for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault&&await c.evaluate(`location.origin==='http://127.0.0.1:8787'`,ctx.id))root=ctx.id;
 await c.evaluate(`(()=>{const style=document.createElement('style');style.id='apk-theme-candidate';style.textContent='#send_textarea {text-rendering:optimizeSpeed;font-kerning:none;font-variant-ligatures:none;}';window.__themeCandidate=style;return true;})()`,root);
 original=await c.evaluate(`(()=>{const ctx=SillyTavern.getContext();return {avatar:ctx.characters[ctx.characterId]?.avatar,chatId:ctx.chatId,input:$('#send_textarea').val()};})()`,root);
 const fixture=await c.evaluate(`(async()=>{
 const ctx=SillyTavern.getContext();const m=await import('/script.js');const name='APK 长聊天优化验证';
 let character=ctx.characters.find(x=>x.name===name);
 if(!character){const card={spec:'chara_card_v2',spec_version:'2.0',data:{name,description:'独立的性能测试数据，不调用模型。',first_mes:'性能测试。',personality:'',scenario:'',mes_example:'',creator_notes:'',system_prompt:'',post_history_instructions:'',alternate_greetings:[],tags:['APK验证'],creator:'local-probe',character_version:'1',extensions:{}}};const form=new FormData();form.append('file_type','json');form.append('avatar',new Blob([JSON.stringify(card)],{type:'application/json'}),'performance.json');const res=await fetch('/api/characters/import',{method:'POST',headers:ctx.getRequestHeaders({omitContentType:true}),body:form});if(!res.ok)throw new Error('Fixture import failed');const imported=await res.json();await m.getCharacters();character=m.characters.find(x=>x.avatar===imported.file_name+'.png');}
 const id=m.characters.findIndex(x=>x.avatar===character.avatar);await m.selectCharacterById(id,{switchMenu:false});
 const current=SillyTavern.getContext();const file='APK-longchat-300';
 const body='性能验证段落：'+('这是一段用于测试长聊天显示的固定内容。'.repeat(12));
 const table='| 属性 | 数值 | 说明 |\\n|---|---|---|\\n'+Array.from({length:12},(_,i)=>'| 属性'+i+' | '+i+' | '+body.slice(0,48)+' |').join('\\n');
 const text=[body,body,table,'\\n- 状态一\\n- 状态二\\n- 状态三','\\n'+body, '\\n<details><summary>展开附加信息</summary>'+body+'</details>'].join('\\n\\n');
 const messages=Array.from({length:300},(_,i)=>({name:i%2?'APK 长聊天优化验证':'User',is_user:!(i%2),is_system:false,send_date:'2026-10-02',mes:'第 '+i+' 楼\\n\\n'+text,extra:{}}));
 const response=await fetch('/api/chats/save',{method:'POST',headers:current.getRequestHeaders(),body:JSON.stringify({avatar_url:character.avatar,file_name:file,chat:[{user_name:'User',character_name:name,chat_metadata:{}},...messages]})});if(!response.ok)throw new Error('Fixture save failed '+response.status);
 await current.openCharacterChat(file);return {avatar:character.avatar,file,rawCharacters:text.length,messages:messages.length};
 })()`,root);
 report.fixture=fixture;
 report.renderedMarkup=await c.evaluate(`({tables:document.querySelectorAll('#chat .mes_text table').length,paragraphs:document.querySelectorAll('#chat .mes_text p').length})`,root);
 assert.ok(report.renderedMarkup.tables>0 && report.renderedMarkup.paragraphs>0,'Markdown fixture did not render');
 const measure=`(async()=>{
 const ctx=SillyTavern.getContext();const m=await import('/script.js');const t=performance.now();await ctx.reloadCurrentChat();document.querySelector('#chat').offsetHeight;const reloadMs=performance.now()-t;
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const chat=document.querySelector('#chat');chat.scrollTop=chat.scrollHeight;
 const messages=chat.querySelectorAll(':scope > .mes').length;const ids=[...chat.querySelectorAll(':scope > .mes')].map(e=>Number(e.getAttribute('mesid')));
 const work=[];const last=ctx.chat.length-1;const initial=ctx.chat[last].mes;
 for(let i=0;i<30;i++){const ms=await new Promise(resolve=>requestAnimationFrame(()=>{const start=performance.now();ctx.chat[last].mes=initial+'\\n\\n新增流式内容 '+i;m.updateMessageBlock(last,ctx.chat[last]);chat.offsetHeight;setTimeout(()=>resolve(performance.now()-start),0);}));work.push(ms);}
 ctx.chat[last].mes=initial;m.updateMessageBlock(last,ctx.chat[last]);
 const area=document.querySelector('#send_textarea');const before=area.value;area.value=('长文本输入验证。'.repeat(6000)).slice(0,50000);const keys=[];
 for(let i=0;i<40;i++){keys.push(await new Promise(resolve=>requestAnimationFrame(()=>{const start=performance.now();area.value+='字';area.dispatchEvent(new Event('input',{bubbles:true}));area.offsetHeight;setTimeout(()=>resolve(performance.now()-start),0);})));}
 area.value=before;area.dispatchEvent(new Event('input',{bubbles:true}));
 const q=(a,p)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];return {reloadMs,messages,firstId:ids[0],lastId:ids.at(-1),updateMedianMs:q(work,.5),updateP95Ms:q(work,.95),inputMedianMs:q(keys,.5),inputP95Ms:q(keys,.95),height:chat.scrollHeight,profile:window.__apkMobilePerformance.status()};
 })()`;
 // Warm each setting first, then alternate to reduce warm-up/order effects.
 for(const enabled of [false,true,false,true,true,false]){
  await c.evaluate(`(()=>{if(${enabled})document.head.appendChild(window.__themeCandidate);else window.__themeCandidate.remove();return true;})()`,root);
  await new Promise(r=>setTimeout(r,700));
  const value=await c.evaluate(measure,root);value.enabled=enabled;report.samples.push(value);
  assert.equal(value.messages,30);assert.equal(value.lastId,299);
  fs.writeFileSync('artifacts/theme/actual-font-shaping.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({enabled,reloadMs:value.reloadMs,updateP95Ms:value.updateP95Ms,inputP95Ms:value.inputP95Ms,messages:value.messages}));
 }
 await c.evaluate(`(()=>{document.head.appendChild(window.__themeCandidate);return true;})()`,root);
 const paging=await c.evaluate(`(async()=>{const ctx=SillyTavern.getContext();await ctx.reloadCurrentChat();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const chat=document.querySelector('#chat');chat.scrollTop=0;const marker=chat.querySelector('.mes');const top=marker.getBoundingClientRect().top;const m=await import('/script.js');await m.showMoreMessages();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {messages:chat.querySelectorAll(':scope > .mes').length,firstId:Number(chat.querySelector('.mes').getAttribute('mesid')),anchorMovement:marker.getBoundingClientRect().top-top};})()`,root);
 report.paging=paging;assert.equal(paging.messages,60);assert.equal(paging.firstId,240);assert.ok(Math.abs(paging.anchorMovement)<30,'Paging scroll anchor moved too far');
 report.completedAt=new Date().toISOString();
}finally{
 await c.evaluate(`window.__themeCandidate?.remove();true`,root);
 if(original?.avatar)await c.evaluate(`(async()=>{const m=await import('/script.js');const id=m.characters.findIndex(x=>x.avatar===${JSON.stringify(original.avatar)});await m.selectCharacterById(id,{switchMenu:false});const ctx=SillyTavern.getContext();if(ctx.chatId!==${JSON.stringify(original.chatId)})await ctx.openCharacterChat(${JSON.stringify(original.chatId)});$('#send_textarea').val(${JSON.stringify(original.input)}).trigger('input');return true;})()`,root);
 fs.writeFileSync('artifacts/theme/actual-font-shaping.json',JSON.stringify(report,null,2));c.close();
}
