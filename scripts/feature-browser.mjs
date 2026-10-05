import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect('http://127.0.0.1:');try{
 const action=process.argv[2];let result;
 if(action==='navigate')result=await c.call('Page.navigate',{url:process.argv[3]});
 else if(action==='click'||action==='click-modal'){
  const position=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(process.argv[3])});if(!e)throw Error('Missing element');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...position});const released=c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...position});if(action==='click-modal')await Promise.race([released,new Promise(r=>setTimeout(r,500))]);else await released;result={clicked:process.argv[3]};
 }else if(action==='eval')result=await c.evaluate(fs.readFileSync(process.argv[3],'utf8'));
 else if(action==='wait'){
  const key=process.argv[3];let found=false;for(let n=0;n<100;n++){const value=await c.evaluate(`window.__androidProbe?.[${JSON.stringify(key)}]`);if(value!==undefined){result={key,value};found=true;break;}await new Promise(r=>setTimeout(r,200));}if(!found)throw Error('Probe result did not arrive: '+key);
 }
 else if(action==='wait-management'){
  let found=false;for(let n=0;n<100;n++){try{result=await c.evaluate(`window.__apkManagement?.status`);if(result){found=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!found)throw Error('Management page did not become ready');
 }
 else if(action==='snapshot')result=await c.evaluate(`({url:location.href,title:document.title,probe:window.__androidProbe,extension:window.__apkExtensionProbe,management:window.__apkManagement?.status})`);
 else if(action==='reload')result=await c.call('Page.reload');
 else throw Error('Unknown browser action');
 if(process.env.FEATURE_OUTPUT)fs.writeFileSync(process.env.FEATURE_OUTPUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{c.close();}
