import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();
try {
 const host=await c.evaluate(`(async()=>{
  const {power_user}=await import('/scripts/power-user.js');
  const styles=[...document.styleSheets].map(sheet=>{try{return {href:sheet.href,owner:sheet.ownerNode?.id,rules:sheet.cssRules.length,has:[...sheet.cssRules].filter(r=>r.selectorText?.includes(':has(')).length};}catch{return {href:sheet.href,inaccessible:true}}});
  const nodes=['#chat','#sheld','#send_textarea','#send_form','#top-settings-holder','.mes','.mes_text'];
  return {profile:window.__apkMobilePerformance?.status(),theme:power_user.theme,settings:{fast_ui_mode:power_user.fast_ui_mode,blur_strength:power_user.blur_strength,chat_truncation:power_user.chat_truncation},styles,nodes:nodes.map(selector=>{const node=document.querySelector(selector);if(!node)return {selector};const s=getComputedStyle(node);return {selector,rect:node.getBoundingClientRect().toJSON(),font:s.fontFamily,filter:s.filter,backdrop:s.backdropFilter,contain:s.contain,overflow:s.overflow,visibility:s.contentVisibility};}),frameProtected:[...document.querySelectorAll('iframe')].every(f=>!f.closest('.apk-deferred-message'))};})()`);
 const checks=[];
 for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault){try {if(await c.evaluate(`document.title==='TavernMark 酒馆排位赛' && !!window.__TAVERNMARK`,ctx.id)){await c.evaluate(`parent.document.querySelector('#chat').scrollTop=0`,ctx.id);await c.evaluate(`window.__TAVERNMARK.selfCheck()`,ctx.id);checks.push(await c.evaluate(`window.__TAVERNMARK.checks()`,ctx.id));}}catch {}}
 fs.writeFileSync('artifacts/theme/inspection.json',JSON.stringify({host,checks},null,2));
 const shot=await c.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/theme/before.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({profile:host.profile,theme:host.theme,settings:host.settings,checks}));
}finally{c.close()}
