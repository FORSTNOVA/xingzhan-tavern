import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base=process.env.TAVERN_TEST_BASE || 'http://127.0.0.1:18787';
const diagnosticsBase=process.env.TAVERN_DIAGNOSTICS_BASE || 'http://127.0.0.1:18788';
const mockBase=process.env.TAVERN_MOCK_BASE || 'http://10.0.2.2:18888/v1';
const reportPath=process.env.TAVERN_TEST_REPORT || 'artifacts/smoke.json';
const results={at:new Date().toISOString(),checks:[]};
let disconnectObserved=false;
const mock=http.createServer(async(req,res)=>{
    let raw=''; for await(const chunk of req) raw+=chunk;
    if(req.url!='/v1/chat/completions'){res.writeHead(404);res.end();return;}
    const body=JSON.parse(raw);
    if(body.messages?.[0]?.content==='disconnect-probe'){
        res.writeHead(200,{'Content-Type':'text/event-stream'});
        res.write('data: {"choices":[{"delta":{"content":"first"}}]}\n\n');
        const timer=setInterval(()=>res.write(': keepalive\n\n'),100);
        res.on('close',()=>{disconnectObserved=true;clearInterval(timer)});return;
    }
    if(body.stream){
        res.writeHead(200,{'Content-Type':'text/event-stream'});
        for(const content of ['安卓','内嵌','验证成功']){
            res.write(`data: ${JSON.stringify({id:'probe',object:'chat.completion.chunk',choices:[{index:0,delta:{content},finish_reason:null}]})}\n\n`);
            await new Promise(resolve=>setTimeout(resolve,300));
        }
        res.end('data: [DONE]\n\n');
    } else {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{role:'assistant',content:'安卓内嵌验证成功'}}]}));}
});
await new Promise(resolve=>mock.listen(18888,'0.0.0.0',resolve));
try{
    const home=await fetch(base+'/'); assert.equal(home.status,200); assert.match(await home.text(),/SillyTavern/); results.checks.push('HTML 200');
    const tokenResponse=await fetch(base+'/csrf-token');
    const {token}=await tokenResponse.json();
    const cookie=tokenResponse.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    assert.ok(token); assert.ok(cookie);
    const headers={'Content-Type':'application/json','X-CSRF-Token':token,Cookie:cookie};
    async function post(url,body){return fetch(base+url,{method:'POST',headers,body:JSON.stringify(body)});}
    const denied=await fetch(base+'/api/settings/get',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(denied.status,403); results.checks.push('CSRF enforced');
    const settings=await post('/api/settings/get',{}); assert.equal(settings.status,200); assert.ok((await settings.json()).settings); results.checks.push('Settings API');
    const chars=await post('/api/characters/all',{}); assert.equal(chars.status,200); assert.ok(Array.isArray(await chars.json())); results.checks.push('Characters API');
    const form=new FormData();form.append('file_type','png');form.append('avatar',new Blob([fs.readFileSync('vendor/SillyTavern/default/content/default_Seraphina.png')],{type:'image/png'}),'sample.png');
    const imported=await fetch(base+'/api/characters/import',{method:'POST',headers:{'X-CSRF-Token':token,Cookie:cookie},body:form});
    assert.equal(imported.status,200);const importedCard=await imported.json();assert.ok(importedCard.file_name);
    const importedAvatar=importedCard.file_name+'.png';
    try {
        const after=await(await post('/api/characters/all',{})).json();assert.ok(after.some(c=>c.avatar===importedAvatar));
        results.checks.push('PNG card import/read/delete using Android WASM image support');
    } finally {
        const deleted=await post('/api/characters/delete',{avatar_url:importedAvatar,delete_chats:false});assert.equal(deleted.status,200);
    }
    const request={chat_completion_source:'custom',custom_url:mockBase,model:'probe',messages:[{role:'user',content:'测试'}],max_tokens:20,temperature:0.7,stream:false};
    const complete=await post('/api/backends/chat-completions/generate',request);assert.equal(complete.status,200);
    const answer=await complete.json();assert.equal(answer.choices[0].message.content,'安卓内嵌验证成功');results.checks.push('Non-streaming generation via actual ST endpoint and mock upstream');
    const stream=await post('/api/backends/chat-completions/generate',{...request,stream:true});assert.equal(stream.status,200);
    const output=await stream.text();assert.match(output,/安卓/);assert.match(output,/验证成功/);assert.match(output,/\[DONE\]/);results.checks.push('SSE generation via actual ST endpoint and mock upstream');
    const abort=new AbortController();
    const interrupted=await fetch(base+'/api/backends/chat-completions/generate',{method:'POST',headers,body:JSON.stringify({...request,stream:true,messages:[{role:'user',content:'disconnect-probe'}]}),signal:abort.signal});
    await interrupted.body.getReader().read();abort.abort();
    for(let i=0;i<20&&!disconnectObserved;i++)await new Promise(resolve=>setTimeout(resolve,100));
    assert.ok(disconnectObserved,'Upstream should be cancelled by current ST on client disconnect');
    results.limitations=['Confirmed: current ST cancels upstream generation when client socket disconnects. APK integration alone does not fix this.'];
    const health=await(await fetch(diagnosticsBase+'/health')).json();results.runtime=health;
    console.log(JSON.stringify(results,null,2));
    fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(results,null,2));
}finally{mock.closeAllConnections();mock.close();}
