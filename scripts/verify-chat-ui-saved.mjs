import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const result=JSON.parse(fs.readFileSync('artifacts/chat-ui/result.json','utf8'));
const backup=JSON.parse(fs.readFileSync('artifacts/chat-ui/connection-backup.json','utf8'));
const c=await connect();
try{
 let root;
 for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault&&await c.evaluate(`location.href.startsWith('http://127.0.0.1:8787/')`,ctx.id))root=ctx.id;
 const restored=await c.evaluate(`(async()=>{const ctx=SillyTavern.getContext();if(ctx.characters[ctx.characterId]?.avatar!==${JSON.stringify(result.avatar)})throw new Error('Current chat is not the test character');await ctx.reloadCurrentChat();const m=await import('/script.js');const {oai_settings}=await import('/scripts/openai.js');const res=await fetch('/api/settings/get',{method:'POST',headers:ctx.getRequestHeaders(),body:'{}'});const stored=JSON.parse((await res.json()).settings);return {avatar:ctx.characters[ctx.characterId]?.avatar,chatId:ctx.chatId,messages:ctx.chat.map(x=>({is_user:x.is_user,mes:x.mes})),dom:[...document.querySelectorAll('#chat .mes_text')].map(x=>x.innerText),settingsMatch:m.main_api===${JSON.stringify(backup.mainApi)}&&${JSON.stringify(Object.keys(backup.settings))}.every(k=>oai_settings[k]===${JSON.stringify(backup.settings)}[k]),savedSettingsMatch:stored.main_api===${JSON.stringify(backup.mainApi)}&&${JSON.stringify(Object.keys(backup.settings))}.every(k=>stored.oai_settings[k]===${JSON.stringify(backup.settings)}[k]),visible:document.visibilityState,guardRemoved:!window.__uiProbeOriginalFetch};})()`,root);
 assert.ok(restored.messages.some(m=>m.mes.includes('普通回复验证成功')));
 assert.ok(restored.messages.some(m=>m.mes.includes('STREAM:08')));
 assert.ok(restored.messages.some(m=>m.mes.includes('CANCEL:03')&&!m.mes.includes('CANCEL:04')));
 assert.ok(restored.messages.some(m=>m.mes.includes('BACKGROUND:45')));
 assert.ok(restored.dom.some(t=>t.includes('BACKGROUND:45')));
 assert.ok(restored.settingsMatch&&restored.savedSettingsMatch&&restored.guardRemoved);
 result.checks.push({name:'reopened actual saved chat retains all replies and cancelled partial reply',passed:true});
 result.settingsPersistentlyRestored=true;result.reloadVerified=true;
 fs.writeFileSync('artifacts/chat-ui/reloaded-chat.json',JSON.stringify(restored,null,2));
 fs.writeFileSync('artifacts/chat-ui/result.json',JSON.stringify(result,null,2));
 const screenshot=await c.call('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync('artifacts/chat-ui/final-chat.png',Buffer.from(screenshot.data,'base64'));
 console.log(JSON.stringify({checks:result.checks,settingsPersistentlyRestored:true,reloadVerified:true,visible:restored.visible}));
}finally{c.close()}
