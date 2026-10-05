import http from 'node:http';
import fs from 'node:fs';
const directory='artifacts/relay';fs.mkdirSync(directory,{recursive:true});
const pcm=Buffer.alloc(24000*2);for(let i=0;i<24000;i++)pcm.writeInt16LE(Math.round(5000*Math.sin(2*Math.PI*440*i/24000)),i*2);
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKZsAAAAASUVORK5CYII=';
const requests=[];const cancellations=[];
http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
 res.once('close',()=>{if(!res.writableEnded){cancellations.push(req.url);fs.writeFileSync(directory+'/mock-cancellations.json',JSON.stringify(cancellations));}});
 requests.push({path:req.url,authorized:req.headers.authorization==='Bearer relay-test-only',body});fs.writeFileSync(directory+'/mock-requests.json',JSON.stringify(requests,null,2));
 const fail=req.url.includes('fail-401'),missing=req.url.includes('missing-data'),slow=req.url.includes('slow-response');
 if(fail){res.writeHead(401,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:{message:'upstream secret must not escape relay-test-only'}}));}
 const audio=body.generationConfig?.responseModalities?.includes('AUDIO');
 const reply={candidates:[{content:{role:'model',parts:missing?[{text:'No generated media'}]:[{inlineData:{mimeType:audio?'audio/L16;codec=pcm;rate=24000':'image/png',data:audio?pcm.toString('base64'):image}}]},finishReason:'STOP'}]};
 const send=()=>{if(!res.destroyed){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(reply));}};if(slow)setTimeout(send,8000);else send();
}).listen(18891,'0.0.0.0',()=>console.log('Relay mock listening on 18891'));
