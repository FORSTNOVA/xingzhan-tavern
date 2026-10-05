import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const original=JSON.parse(fs.readFileSync('artifacts/theme/original-host.json','utf8').replace(/^\uFEFF/,''));
const c=await connect();const report={nativeInsertion:[],checkedAt:new Date().toISOString()};let draft;
try{
 for(let i=0;i<60 && !await c.evaluate('!!window.__apkMobilePerformance');i++)await new Promise(r=>setTimeout(r,500));
 assert.ok(await c.evaluate('!!window.__apkMobilePerformance'),'Optimization did not initialize');
 draft=await c.evaluate(`document.querySelector('#send_textarea').value`);
 const state=()=>c.evaluate(`(async()=>{const {power_user:p}=await import('/scripts/power-user.js');const a=document.querySelector('#send_textarea');const s=getComputedStyle(a);return {theme:p.theme,customCss:p.custom_css,fast:p.fast_ui_mode,blur:p.blur_strength,font:s.fontFamily,color:s.color,height:a.getBoundingClientRect().height,long:a.hasAttribute('data-apk-long-input'),profile:window.__apkMobilePerformance.status()};})()`);
 const before=await state();assert.equal(before.customCss,original.settings.custom_css);assert.equal(before.fast,original.settings.fast_ui_mode);assert.equal(before.blur,original.settings.blur_strength);
 await c.evaluate(`(()=>{const a=document.querySelector('#send_textarea');a.value='短文本输入检查。';a.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 report.short=await state();assert.equal(report.short.long,false);
 await c.evaluate(`(()=>{const a=document.querySelector('#send_textarea');a.value='字'.repeat(4090);a.dispatchEvent(new Event('input',{bubbles:true}));a.focus({preventScroll:true});a.setSelectionRange(a.value.length,a.value.length);return true;})()`);
 await c.call('Input.insertText',{text:'逐字输入检查文字'});
 report.ordinaryLong=await state();assert.equal(report.ordinaryLong.long,false);assert.equal(report.ordinaryLong.font,report.short.font);
 await c.evaluate(`(()=>{const a=document.querySelector('#send_textarea');a.value='长文本输入验证。'.repeat(6250);a.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 report.long=await state();assert.equal(report.long.long,true);assert.ok(report.long.font.includes('system-ui'));assert.equal(report.long.color,report.short.color);
 for(const enabled of [false,true]){
  await c.evaluate(`window.__apkMobilePerformance.setEnabled(${enabled})`);
  const value=await state();assert.equal(value.fast,before.fast);assert.equal(value.blur,before.blur);assert.equal(value.customCss,before.customCss);
  await c.evaluate(`(()=>{const a=document.querySelector('#send_textarea');a.value='长文本输入验证。'.repeat(6250);a.dispatchEvent(new Event('input',{bubbles:true}));a.focus({preventScroll:true});a.setSelectionRange(a.value.length,a.value.length);window.__themeNativeInput=a;window.__themeNativeInputTimes=[];window.__themeNativeInputListener=()=>{const start=performance.now();requestAnimationFrame(()=>window.__themeNativeInputTimes.push(performance.now()-start));};a.addEventListener('input',window.__themeNativeInputListener,{capture:true});return true;})()`);
  for(let i=0;i<8;i++){await c.call('Input.insertText',{text:'字'});await c.evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);}
  const sample=await c.evaluate(`(()=>{const a=window.__themeNativeInput;a.removeEventListener('input',window.__themeNativeInputListener,{capture:true});return {timings:window.__themeNativeInputTimes,length:a.value.length,font:getComputedStyle(a).fontFamily,long:a.hasAttribute('data-apk-long-input')};})()`);
  assert.equal(sample.length,50008);assert.equal(sample.timings.length,8);report.nativeInsertion.push({enabled,...sample});
 }
 report.passed=true;
}finally{
 await c.evaluate(`(()=>{const a=document.querySelector('#send_textarea');if(window.__themeNativeInputListener)a.removeEventListener('input',window.__themeNativeInputListener,{capture:true});a.blur();a.value=${JSON.stringify(draft??'')};a.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 for(const key of ['short','long','ordinaryLong'])if(report[key])delete report[key].customCss;
 fs.writeFileSync('artifacts/theme/native-verification.json',JSON.stringify(report,null,2));c.close();
}
console.log(JSON.stringify(report));
