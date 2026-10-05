import fs from 'node:fs';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {connect} from './webview-cdp.mjs';
const adbPath='C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const adb=(...args)=>execFileSync(adbPath,['-s','ca168055',...args],{encoding:'utf8',timeout:15000}).trim();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const report='artifacts/background-allowed-webview.json';
const result={startedAt:new Date().toISOString(),scope:'Actual ST generation endpoint called from APK WebView; mock upstream; no chat settings changed; USB charging; not UI chat persistence or reconnection',samples:[],upstream:{sent:0,done:false}};
const start=Date.now();let phase='foreground';const save=()=>fs.writeFileSync(report,JSON.stringify(result,null,2));
const activityTask=adb('shell','dumpsys','activity','activities','cn.jiuguan.probe').match(/ActivityRecord\{[^\n]*cn\.jiuguan\.probe\/\.MainActivity t(\d+)/)?.[1];
if(!activityTask)throw new Error('Activity task ID missing');
async function sample(){
 const s={seconds:Math.round((Date.now()-start)/1000),phase,pid:adb('shell','pidof','cn.jiuguan.probe')};
 s.task=JSON.parse(adb('shell','run-as','cn.jiuguan.probe','cat','files/tavern/probe-state.json'));delete s.task.text;
 s.wakefulness=adb('shell','dumpsys','power').split('\n').find(l=>l.includes('mWakefulness='))?.trim();
 s.upstreamSent=result.upstream.sent;
 result.samples.push(s);save();console.log(JSON.stringify(s));
}
const mock=http.createServer(async(req,res)=>{
 for await(const chunk of req){}
 result.upstream.requestAt=Math.round((Date.now()-start)/1000);
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 const timer=setInterval(()=>{result.upstream.sent++;res.write(`data: ${JSON.stringify({choices:[{index:0,delta:{content:`${result.upstream.sent} `},finish_reason:null}]})}\n\n`);if(result.upstream.sent>=90){clearInterval(timer);result.upstream.done=true;result.upstream.completedAt=Math.round((Date.now()-start)/1000);res.end('data: [DONE]\n\n');save();}},1000);
 res.on('close',()=>{clearInterval(timer);result.upstream.closedAt=Math.round((Date.now()-start)/1000);save();});
});
await new Promise(r=>mock.listen(18888,'127.0.0.1',r));
const c=await connect();
try{
 adb('reverse','tcp:18888','tcp:18888');
 let root;
 for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault && await c.evaluate(`location.href.startsWith('http://127.0.0.1:8787/')`,ctx.id))root=ctx.id;
 if(!root)throw new Error('Main WebView context missing');
 const fixture=await fetch('http://127.0.0.1:19788/test',{method:'POST',signal:AbortSignal.timeout(10000)});
 if(fixture.status!==202)throw new Error('Fixture start failed '+fixture.status);
 await c.evaluate(`(()=>{
 const state=window.__backgroundWebViewProbe={startedAt:Date.now(),received:0,done:false,events:[]};
 (async()=>{try{
  const {token}=await(await fetch('/csrf-token')).json();
  const response=await fetch('/api/backends/chat-completions/generate',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({chat_completion_source:'custom',custom_url:'http://127.0.0.1:18888/v1',model:'probe',messages:[{role:'user',content:'WebView本地后台验证'}],stream:true,max_tokens:100})});
  state.status=response.status;const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';
  while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});let p;while((p=buffer.indexOf('\\n\\n'))>=0){const event=buffer.slice(0,p);buffer=buffer.slice(p+2);if(event.includes('[DONE]'))state.done=true;else if(event.startsWith('data: ')){state.received++;state.events.push({seconds:Math.round((Date.now()-state.startedAt)/1000),visibility:document.visibilityState});}}}
 }catch(e){state.error=String(e);}finally{state.finishedAt=Date.now();}})();return true;
 })()`,root);
 await wait(5000);await sample();adb('shell','input','keyevent','KEYCODE_HOME');phase='home';
 await wait(20000);await sample();adb('shell','input','keyevent','KEYCODE_SLEEP');phase='screen-off';
 for(let i=0;i<4;i++){await wait(25000);await sample();}
 // The backend fixture and mock should have finished while the screen is still off.
 result.offscreenCheckpoint=result.samples.at(-1);save();
 adb('shell','input','keyevent','KEYCODE_WAKEUP');phase='restore-requested';
 // Focus the existing task without delivering an Intent that would reload the page.
 adb('shell','am','task','focus',activityTask);
 c.close();await wait(3000);
 const next=await connect();
 try{
  for(const ctx of next.contexts.values())if(ctx.auxData?.isDefault){try{const value=await next.evaluate('window.__backgroundWebViewProbe || null',ctx.id);if(value)result.webview=value;}catch{}}
 }finally{next.close();}
 result.completedAt=new Date().toISOString();
 result.passed=result.offscreenCheckpoint.task.count===120 && result.offscreenCheckpoint.task.running===false && result.upstream.done && result.webview?.received===90 && result.webview?.done===true;
 save();console.log(JSON.stringify({report,passed:result.passed,offscreenCheckpoint:result.offscreenCheckpoint,upstream:result.upstream,webview:result.webview}));
}catch(e){result.error=String(e);save();throw e;}finally{c.close();mock.closeAllConnections();mock.close();}
