import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
const root=path.resolve('artifacts/features/git-fixture');fs.mkdirSync(root,{recursive:true});
const work=path.join(root,'work');const bare=path.join(root,'apk-fixture.git');
function git(args,cwd=work){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
function content(version){fs.writeFileSync(path.join(work,'manifest.json'),JSON.stringify({display_name:'APK compatibility fixture',loading_order:9999,requires:[],optional:[],js:'index.js',author:'local verification',version:String(version),homePage:'https://docs.sillytavern.app/'}));fs.writeFileSync(path.join(work,'index.js'),`window.__apkExtensionProbe={version:${version},loaded:true};\n`);}
if(!fs.existsSync(bare)){
 fs.mkdirSync(work,{recursive:true});git(['init','-b','main']);git(['config','user.name','Local verification']);git(['config','user.email','local@localhost']);content(1);git(['add','.']);git(['commit','-m','version 1']);
 git(['checkout','-b','alternate']);content(3);git(['add','.']);git(['commit','-m','alternate version 3']);git(['checkout','main']);
 git(['clone','--bare',work,bare],root);git(['remote','add','origin',bare]);
}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/publish-v2'&&req.method==='POST'){try{git(['checkout','main']);content(2);git(['add','.']);if(git(['status','--porcelain']))git(['commit','-m','version 2']);git(['push','origin','main']);res.end(JSON.stringify({commit:git(['rev-parse','HEAD'])}));}catch(e){res.writeHead(500);res.end(e.message);}return;}
 if(!url.pathname.startsWith('/apk-fixture.git/')){res.writeHead(404);res.end();return;}
 const process=spawn('git',['http-backend'],{env:{...globalThis.process.env,GIT_PROJECT_ROOT:root,GIT_HTTP_EXPORT_ALL:'1',PATH_INFO:url.pathname,QUERY_STRING:url.search.slice(1),REQUEST_METHOD:req.method,CONTENT_TYPE:req.headers['content-type']||'',CONTENT_LENGTH:req.headers['content-length']||'0',REMOTE_ADDR:'127.0.0.1'}});
 const chunks=[];process.stdout.on('data',chunk=>chunks.push(chunk));process.stderr.on('data',()=>{});
 process.on('error',error=>{res.writeHead(500);res.end(error.message);});process.on('close',()=>{
  const buffer=Buffer.concat(chunks);let end=buffer.indexOf('\r\n\r\n');let skip=4;if(end<0){end=buffer.indexOf('\n\n');skip=2;}if(end<0){res.writeHead(500);res.end('Invalid CGI response');return;}
  let code=200;const headers={};for(const line of buffer.subarray(0,end).toString().split(/\r?\n/)){const colon=line.indexOf(':');if(colon<0)continue;const key=line.slice(0,colon).trim();const value=line.slice(colon+1).trim();if(key.toLowerCase()==='status')code=parseInt(value);else headers[key]=value;}
  res.writeHead(code,headers);res.end(buffer.subarray(end+skip));
 });req.pipe(process.stdin);
}).listen(18889,'127.0.0.1',()=>console.log('Local Git compatibility fixture ready on 18889'));
