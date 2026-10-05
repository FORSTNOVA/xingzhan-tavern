import http from 'node:http';
import fs from 'node:fs';
const budget=JSON.parse(fs.readFileSync('artifacts/tts-acceptance/current-budget.json'));
const caps={text:budget.text.authorized-budget.text.used,tts:budget.tts.authorized-budget.tts.used},calls={text:0,tts:0};let stopped=false;
http.createServer(async(req,res)=>{
 try{
  if(req.url==='/health'){res.end(JSON.stringify({caps,calls,stopped}));return;}
  const kind=req.url==='/v1/chat/completions'?'text':/^\/v1beta\/models\/[A-Za-z0-9_.-]+:generateContent$/.test(req.url)?'tts':null;
  if(!kind||req.method!=='POST'){res.writeHead(404);res.end();return;}
  if(stopped||calls[kind]>=caps[kind]){res.writeHead(429);res.end(JSON.stringify({error:{message:'Acceptance relay request cap or stop condition reached'}}));return;}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024)throw Error('Body too large');chunks.push(chunk);}
  calls[kind]++;const upstream=await fetch('https://tingleis.dpdns.org'+req.url,{method:'POST',headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},body:Buffer.concat(chunks),signal:AbortSignal.timeout(180000)});
  if([401,403,429].includes(upstream.status))stopped=true;
  console.log(JSON.stringify({kind,call:calls[kind],status:upstream.status}));res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('Content-Type')||'application/json'});for await(const chunk of upstream.body)res.write(chunk);res.end();
 }catch(error){stopped=true;console.log(JSON.stringify({connectionFailed:true,error:error.message}));if(!res.headersSent)res.writeHead(502);res.end(JSON.stringify({error:{message:'Acceptance relay connection failed'}}));}
}).listen(21987,'127.0.0.1',()=>console.log('Temporary acceptance relay ready on 21987; no keys or text are logged.'));
