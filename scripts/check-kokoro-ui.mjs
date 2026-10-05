import {connect} from './webview-cdp.mjs';
const c=await connect();
try{
 const result=await c.evaluate(`(async()=>{const response=await fetch('/scripts/extensions/third-party/xingzhan-synthesis/kokoro-blend.js');const source=await response.text();return{fusionPanel:!!document.querySelector('[data-kokoro-blend]'),summary:document.querySelector('[data-kokoro-blend] summary')?.textContent,helperStatus:response.status,helperContainsBlend:source.includes('createKokoroBlend')}})()`);
 console.log(JSON.stringify(result,null,2));
 if(!result.fusionPanel||result.helperStatus!==200||!result.helperContainsBlend)process.exitCode=1;
}finally{c.close();}
