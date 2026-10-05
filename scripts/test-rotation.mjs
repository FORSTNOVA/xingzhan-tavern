import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {connect} from './webview-cdp.mjs';
const serial=process.env.ANDROID_SERIAL||'emulator-5554',baseline=process.argv.includes('--baseline');
const adb='C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const shell=(...args)=>execFileSync(adb,['-s',serial,'shell',...args],{encoding:'utf8'}).trim();
const original={auto:shell('settings','get','system','accelerometer_rotation'),rotation:shell('settings','get','system','user_rotation')};
const token=crypto.randomUUID();let c,previous,results=[];
const open=async()=>{for(let i=0;i<30;i++){try{return await connect();}catch{await new Promise(r=>setTimeout(r,200));}}throw Error('WebView unavailable');};
try{
 shell('settings','put','system','accelerometer_rotation','0');shell('settings','put','system','user_rotation','0');await new Promise(r=>setTimeout(r,800));c=await open();
 previous=await c.evaluate(`(()=>{const input=document.querySelector('[data-speech-text]')||document.querySelector('#send_textarea');const probe=document.createElement('textarea');probe.id='rotation-state-probe';probe.value='未保存的旋转验证正文';probe.style.display='none';document.body.append(probe);window.__rotationProbe={token:${JSON.stringify(token)},ticks:0};window.__rotationTimer=setInterval(()=>window.__rotationProbe.ticks++,100);const originalInput=input?.value;if(input)input.value='旋转测试：未保存正文';return {timeOrigin:performance.timeOrigin,input:originalInput,expectedInput:input?.value,url:location.href,width:innerWidth,height:innerHeight};})()`);
 for(const rotation of baseline?[1]:[1,0,3,0]){
  c.close();shell('settings','put','system','user_rotation',String(rotation));await new Promise(r=>setTimeout(r,900));c=await open();
  const state=await c.evaluate(`({token:window.__rotationProbe?.token,timeOrigin:performance.timeOrigin,ticks:window.__rotationProbe?.ticks,text:document.querySelector('#rotation-state-probe')?.value,input:(document.querySelector('[data-speech-text]')||document.querySelector('#send_textarea'))?.value,url:location.href,width:innerWidth,height:innerHeight})`);
  const passed=state.token===token&&state.timeOrigin===previous.timeOrigin&&state.text==='未保存的旋转验证正文'&&state.input===previous.expectedInput&&state.url===previous.url&&state.ticks>0;results.push({rotation,...state,passed});
  if(!baseline&&(!passed||(rotation%2===1?state.width<=state.height:state.width>=state.height)))throw Error('Rotation reloaded the page or did not resize: '+JSON.stringify(state));
 }
 const report={serial,baseline,original,previous,rotations:results,passed:!baseline&&results.every(x=>x.passed),paidRequests:0};fs.mkdirSync('artifacts/rotation',{recursive:true});fs.writeFileSync('artifacts/rotation/'+serial+(baseline?'-before':'-after')+'.json',JSON.stringify(report,null,2));console.log(report);
}finally{
 try{await c?.evaluate(`(()=>{const input=document.querySelector('[data-speech-text]')||document.querySelector('#send_textarea');if(input&&window.__rotationProbe&&${JSON.stringify(previous?.input)}!==undefined)input.value=${JSON.stringify(previous?.input)};})();clearInterval(window.__rotationTimer);delete window.__rotationTimer;delete window.__rotationProbe;document.querySelector('#rotation-state-probe')?.remove();`);}catch{}c?.close();
 for(const [key,value] of [['user_rotation',original.rotation],['accelerometer_rotation',original.auto]])shell('settings',value==='null'?'delete':'put','system',key,...(value==='null'?[]:[value]));
}
