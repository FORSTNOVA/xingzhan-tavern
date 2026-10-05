import fs from 'node:fs';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
const label=process.argv[2] || 'baseline';
const report=`artifacts/background-${label}.json`;
const adbPath='C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const adb=(...args)=>execFileSync(adbPath,['-s','ca168055',...args],{encoding:'utf8',timeout:15000}).trim();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const data={label,startedAt:new Date().toISOString(),scope:'USB charging; local mocked upstream; PC client remains connected; no battery-only or WebView reconnection claim',samples:[],sse:{sent:0,received:0,done:false,times:[]}};
const save=()=>fs.writeFileSync(report,JSON.stringify(data,null,2));
let phase='foreground';const start=Date.now();
async function snapshot(){
 const sample={seconds:Math.round((Date.now()-start)/1000),phase,pid:adb('shell','pidof','cn.jiuguan.probe')};
 try{sample.task=JSON.parse(adb('shell','run-as','cn.jiuguan.probe','cat','files/tavern/probe-state.json'));delete sample.task.text;}catch(e){sample.taskError=String(e);}
 const power=adb('shell','dumpsys','power');
 sample.power=power.split('\n').filter(l=>/mWakefulness=|mIsPowered=|mPlugType=|TavernProbe:BackgroundComparison/.test(l)).map(l=>l.trim());
 sample.service=adb('shell','dumpsys','activity','services','cn.jiuguan.probe').split('\n').filter(l=>/isForeground=|app=ProcessRecord/.test(l)).map(l=>l.trim());
 const policy=adb('shell','dumpsys','window','policy');
 sample.keyguard=policy.split('\n').filter(l=>/^\s*(showing=|secure=|inputRestricted=|mKeyguardOccluded=)/.test(l)).map(l=>l.trim());
 sample.streamReceived=data.sse.received;
 data.samples.push(sample);save();console.log(JSON.stringify(sample));
}
const mock=http.createServer(async(req,res)=>{
 for await(const chunk of req){}
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 const timer=setInterval(()=>{data.sse.sent++;res.write(`data: ${JSON.stringify({choices:[{index:0,delta:{content:`${data.sse.sent} `},finish_reason:null}]})}\n\n`);if(data.sse.sent>=90){clearInterval(timer);res.end('data: [DONE]\n\n');}},1000);
 res.on('close',()=>{clearInterval(timer);data.sse.upstreamClosedAt=Math.round((Date.now()-start)/1000);});
});
await new Promise(r=>mock.listen(18888,'127.0.0.1',r));
let stream;
try{
 adb('reverse','tcp:18888','tcp:18888');
 const csrf=await fetch('http://127.0.0.1:19787/csrf-token',{signal:AbortSignal.timeout(10000)});
 const {token}=await csrf.json();const cookie=csrf.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 const response=await fetch('http://127.0.0.1:19788/test',{method:'POST',signal:AbortSignal.timeout(10000)});
 if(response.status!==202)throw new Error('Fixture start failed '+response.status);
 stream=(async()=>{try{
  const response=await fetch('http://127.0.0.1:19787/api/backends/chat-completions/generate',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token,Cookie:cookie},body:JSON.stringify({chat_completion_source:'custom',custom_url:'http://127.0.0.1:18888/v1',model:'probe',messages:[{role:'user',content:'本地后台验证'}],stream:true,max_tokens:100}),signal:AbortSignal.timeout(170000)});
  data.sse.status=response.status;let buffer='';
  for await(const chunk of response.body){buffer+=new TextDecoder().decode(chunk);let p;while((p=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,p);buffer=buffer.slice(p+2);if(event.includes('[DONE]'))data.sse.done=true;else if(event.startsWith('data: ')){data.sse.received++;data.sse.times.push({seconds:Math.round((Date.now()-start)/1000),phase});}}}
 }catch(e){data.sse.error=String(e);}finally{save();}})();
 await wait(5000);await snapshot();adb('shell','input','keyevent','KEYCODE_HOME');phase='home';
 await wait(20000);await snapshot();
 adb('shell','input','keyevent','KEYCODE_SLEEP');phase='screen-off';
 await wait(20000);await snapshot();await wait(25000);await snapshot();
 adb('shell','input','keyevent','KEYCODE_WAKEUP');phase='screen-on-home';
 await wait(5000);await snapshot();
 adb('shell','am','start','-f','0x24000000','-n','cn.jiuguan.probe/.MainActivity','-a','android.intent.action.MAIN');phase='restore-requested';
 for(let i=0;i<5;i++){await wait(15000);await snapshot();if(data.samples.at(-1).task?.running===false && data.sse.done)break;}
 await stream;
 data.completedAt=new Date().toISOString();save();console.log(JSON.stringify({report,sse:data.sse,task:data.samples.at(-1).task}));
}catch(e){data.error=String(e);save();throw e;}finally{mock.closeAllConnections();mock.close();}
