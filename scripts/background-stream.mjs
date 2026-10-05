import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.TAVERN_TEST_BASE || 'http://127.0.0.1:19787';
const mockUrl=process.env.TAVERN_MOCK_BASE || 'http://127.0.0.1:18888/v1';
const report=process.env.TAVERN_BACKGROUND_REPORT || 'artifacts/phone-background-stream.json';
const expected=60;
const start=Date.now();
const mock=http.createServer(async(req,res)=>{
    for await(const chunk of req) { /* Drain the model request. */ }
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    let sent=0;
    const timer=setInterval(()=>{
        sent++;
        res.write(`data: ${JSON.stringify({choices:[{index:0,delta:{content:`${sent} `},finish_reason:null}]})}\n\n`);
        if(sent===expected){clearInterval(timer);res.end('data: [DONE]\n\n');}
    },1000);
    res.on('close',()=>clearInterval(timer));
});
await new Promise(resolve=>mock.listen(18888,'0.0.0.0',resolve));
try{
    const csrf=await fetch(base+'/csrf-token',{signal:AbortSignal.timeout(10000)});
    const {token}=await csrf.json();
    const cookie=csrf.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    console.log('Started 60-second SSE through actual Android SillyTavern endpoint');
    const response=await fetch(base+'/api/backends/chat-completions/generate',{
        method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token,Cookie:cookie},
        body:JSON.stringify({chat_completion_source:'custom',custom_url:mockUrl,model:'probe',messages:[{role:'user',content:'后台流测试'}],stream:true,max_tokens:100}),
        signal:AbortSignal.timeout(90000)
    });
    assert.equal(response.status,200);
    const text=await response.text();
    const events=text.split('\n\n').filter(e=>e.startsWith('data: ')&& !e.includes('[DONE]')).map(e=>JSON.parse(e.slice(6)));
    assert.equal(events.length,expected);assert.match(text,/\[DONE\]/);
    const result={startedAt:new Date(start).toISOString(),elapsedMs:Date.now()-start,expected,received:events.length,done:true,scope:'Actual ST SSE proxy; mock upstream; HTTP client on PC remains connected; not WebView reconnection or battery-only test.'};
    fs.writeFileSync(report,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
    fs.writeFileSync(report,JSON.stringify({startedAt:new Date(start).toISOString(),elapsedMs:Date.now()-start,done:false,error:String(error),cause:String(error.cause || ''),scope:'USB forwarded connection; failure alone does not prove Android app process death.'},null,2));
    throw error;
}finally{mock.closeAllConnections();mock.close();}
