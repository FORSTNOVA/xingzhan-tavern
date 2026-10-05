import fs from 'node:fs';
export async function connect(prefix='http://127.0.0.1:8787/'){
    const targets=await(await fetch((process.env.WEBVIEW_CDP_URL||'http://127.0.0.1:19222')+'/json/list')).json();
    const target=targets.find(t=>t.type==='page'&&t.url.startsWith(prefix));
    if(!target)throw new Error('Tavern WebView target missing');
    const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});
    let id=0;const pending=new Map();const contexts=new Map();const listeners=new Set();
    socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.executionContextCreated')contexts.set(m.params.context.id,m.params.context);if(m.method==='Runtime.executionContextDestroyed')contexts.delete(m.params.executionContextId);if(m.method)for(const listener of listeners)listener(m);if(m.id&&pending.has(m.id)){const {r,j,t}=pending.get(m.id);clearTimeout(t);pending.delete(m.id);m.error?j(new Error(JSON.stringify(m.error))):r(m.result)}};
    const call=(method,params={})=>new Promise((r,j)=>{const n=++id;const t=setTimeout(()=>{pending.delete(n);j(new Error('CDP timeout '+method))},30000);pending.set(n,{r,j,t});socket.send(JSON.stringify({id:n,method,params}))});
    await call('Runtime.enable');await call('Page.enable');
    const evaluate=async(expression,contextId)=>{const r=await call('Runtime.evaluate',{expression,contextId,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value};
    return {call,evaluate,contexts,onEvent:listener=>{listeners.add(listener);return ()=>listeners.delete(listener)},close:()=>{for(const entry of pending.values()){clearTimeout(entry.t);entry.j(new Error('CDP connection closed'));}pending.clear();socket.close();}};
}
if(process.argv[1]?.endsWith('webview-cdp.mjs')){
    const c=await connect();try{
        if(process.argv[2]==='snapshot'){
            for(const ctx of c.contexts.values())if(ctx.auxData?.isDefault){try{const value=await c.evaluate(`({title:document.title,url:location.href,viewport:[innerWidth,innerHeight],body:document.body?.innerText.slice(-6500),iframes:[...document.querySelectorAll('iframe')].map(f=>({id:f.id,src:f.src.slice(0,150),rect:[f.getBoundingClientRect().width,f.getBoundingClientRect().height]}))})`,ctx.id);console.log(JSON.stringify({contextId:ctx.id,...value}));}catch(e){console.log(String(e))}}
        }else{
            const expression=fs.readFileSync(process.argv[2],'utf8');const contextId=process.argv[3]?Number(process.argv[3]):undefined;
            const value=await c.evaluate(expression,contextId);console.log(JSON.stringify(value,null,2));
        }
    }finally{c.close()}
}
