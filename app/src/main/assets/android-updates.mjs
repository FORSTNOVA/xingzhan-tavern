import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
import {patchRuntime} from './android-patches.mjs';
export const BUNDLED_COMMIT='06bde939fb1e9c4c8d8641d810f0a916b5bce127';
export function safePath(root,relative){
 if(typeof relative!=='string'||relative.includes('\\')||relative.includes('\0')||path.isAbsolute(relative)||/^[A-Za-z]:/.test(relative)||relative.split('/').some(p=>p==='..'))throw new Error('不安全的文件路径');
 const absolute=path.resolve(root,relative);if(absolute!==path.resolve(root)&&!absolute.startsWith(path.resolve(root)+path.sep))throw new Error('文件路径越界');return absolute;
}
export function verifyIntegrity(buffer,integrity){
 const entry=String(integrity).split(/\s+/).find(s=>/^(sha512|sha256|sha1)-/.test(s));if(!entry)throw new Error('依赖缺少可校验的摘要');
 const split=entry.indexOf('-');const expected=Buffer.from(entry.slice(split+1),'base64');const actual=crypto.createHash(entry.slice(0,split)).update(buffer).digest();
 if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))throw new Error('下载内容完整性校验失败');
}
export async function download(url,allowedHosts,limit=128*1024*1024){
 let current=new URL(url);
 for(let redirects=0;redirects<5;redirects++){
  if(current.protocol!=='https:'||!allowedHosts.includes(current.hostname)||current.username||current.password)throw new Error('下载来源不受支持');
  const response=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(90000),headers:{'User-Agent':'TavernAndroid/0.2','Accept':'application/vnd.github+json'}});
  if(response.status>=300&&response.status<400){await response.body?.cancel();current=new URL(response.headers.get('location'),current);continue;}
  if(!response.ok)throw new Error('下载失败：HTTP '+response.status);
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('下载文件过大');chunks.push(chunk);}return Buffer.concat(chunks);
 }throw new Error('下载重定向过多');
}
export async function extractZip(buffer,destination,yauzl){
 await fsp.mkdir(destination,{recursive:true});
 await new Promise((resolve,reject)=>yauzl.fromBuffer(buffer,{lazyEntries:true},(error,zip)=>{
  if(error)return reject(error);let rootPrefix;let size=0;let count=0;let failed=false;
  const fail=e=>{if(!failed){failed=true;zip.close();reject(e);}};
  zip.on('error',fail);zip.on('end',()=>{if(!failed)resolve();});
  zip.on('entry',entry=>{(async()=>{
   if(++count>50000||(size+=entry.uncompressedSize)>512*1024*1024)throw new Error('更新包展开过大');
   const name=entry.fileName;if(!rootPrefix)rootPrefix=name.split('/')[0]+'/';if(!name.startsWith(rootPrefix))throw new Error('更新包目录结构无效');
   const relative=name.slice(rootPrefix.length);if(!relative){zip.readEntry();return;}
   const target=safePath(destination,relative);const mode=(entry.externalFileAttributes>>>16)&0xf000;if(mode===0xa000)throw new Error('更新包不允许符号链接');
   if(name.endsWith('/')){await fsp.mkdir(target,{recursive:true});zip.readEntry();return;}
   await fsp.mkdir(path.dirname(target),{recursive:true});const stream=await new Promise((r,j)=>zip.openReadStream(entry,(e,s)=>e?j(e):r(s)));await pipeline(stream,fs.createWriteStream(target,{flags:'wx'}));zip.readEntry();
  })().catch(fail);});zip.readEntry();
 }));
}
export async function extractPackage(buffer,destination,tar){
 await fsp.mkdir(destination,{recursive:true});const extract=tar.extract();let size=0;
 extract.on('entry',(header,stream,next)=>{(async()=>{
  if(!header.name.startsWith('package/'))throw new Error('依赖包目录结构无效');
  const relative=header.name.slice(8);if(!relative){stream.resume();next();return;}
  if(relative.endsWith('.node'))throw new Error('新依赖包含原生模块，需更新 APK');
  const target=safePath(destination,relative);if(!['file','directory'].includes(header.type))throw new Error('依赖包不允许链接或特殊文件');
  if((size+=header.size)>256*1024*1024)throw new Error('依赖包展开过大');
  if(header.type==='directory'){await fsp.mkdir(target,{recursive:true});stream.resume();next();return;}
  await fsp.mkdir(path.dirname(target),{recursive:true});await pipeline(stream,fs.createWriteStream(target));next();
 })().catch(e=>extract.destroy(e));});
 await pipeline(Readable.from(buffer),zlib.createGunzip(),extract);
}
export class UpdateManager{
 constructor(baseRoot){
  this.baseRoot=path.resolve(baseRoot);this.directory=safePath(this.baseRoot,'.apk-updates');fs.mkdirSync(this.directory,{recursive:true});this.stateFile=path.join(this.directory,'state.json');
  try{this.state=JSON.parse(fs.readFileSync(this.stateFile));}catch{this.state={active:'bundled',previous:null,staged:null,autoCheck:true,latest:null};}
  this.job=null;this.require=createRequire(path.join(this.baseRoot,'package.json'));this.write();
 }
 write(){fs.writeFileSync(this.stateFile+'.tmp',JSON.stringify(this.state,null,2));fs.renameSync(this.stateFile+'.tmp',this.stateFile);}
 root(id){if(id==='bundled')return this.baseRoot;if(!/^[a-f0-9]{40}$/.test(id||''))throw new Error('无效的版本标识');return safePath(this.directory,'releases/'+id);}
 status(){return {active:this.state.active,previous:this.state.previous,staged:this.state.staged,latest:this.state.latest,checkedAt:this.state.checkedAt,autoCheck:this.state.autoCheck,backup:this.state.backup,lastError:this.state.lastError,job:this.job,bundled:BUNDLED_COMMIT};}
 async check(){
  const bytes=await download('https://api.github.com/repos/SillyTavern/SillyTavern/commits/release',['api.github.com'],4*1024*1024);const data=JSON.parse(bytes);
  if(!/^[a-f0-9]{40}$/.test(data.sha))throw new Error('官方版本信息无效');
  this.state.latest={commit:data.sha,date:data.commit?.committer?.date,message:String(data.commit?.message||'').split('\n')[0]};this.state.checkedAt=Date.now();this.write();return this.state.latest;
 }
 async dependencies(stage){
  const lock=JSON.parse(await fsp.readFile(path.join(stage,'package-lock.json'),'utf8'));const baseLock=JSON.parse(await fsp.readFile(path.join(this.baseRoot,'package-lock.json'),'utf8'));
  if(lock.lockfileVersion!==3)throw new Error('新版本依赖格式不受支持，需更新 APK');
  const entries=Object.entries(lock.packages).filter(([name,info])=>name&&name.startsWith('node_modules/')&&!info.dev&&(!info.os||info.os.includes('android')||info.os.includes('linux')));
  let completed=0;let cursor=0;
  const install=async()=>{while(cursor<entries.length){const [name,info]=entries[cursor++];safePath(stage,name);
   if(name.endsWith('/onnxruntime-node')||name.includes('/@img/')){completed++;continue;}
   const destination=safePath(stage,name);const original=safePath(this.baseRoot,name);const cached=baseLock.packages[name];
   if(cached?.version===info.version&&cached?.integrity===info.integrity&&fs.existsSync(original)){
    await fsp.mkdir(path.dirname(destination),{recursive:true});await fsp.cp(original,destination,{recursive:true,filter:source=>!source.endsWith('.node')&&!path.relative(original,source).split(path.sep).includes('node_modules')&&!source.split(path.sep).includes('.bin')});
   }else{
    if(!info.resolved||!info.integrity||info.link)throw new Error('依赖缺少固定来源或摘要：'+name);
    if(info.hasInstallScript&&!name.endsWith('/protobufjs'))throw new Error('新依赖需要安装脚本，需更新 APK：'+name);
    const bytes=await download(info.resolved,['registry.npmjs.org']);verifyIntegrity(bytes,info.integrity);await extractPackage(bytes,destination,this.require('tar-stream'));
   }
   this.job.detail=`准备依赖 ${++completed}/${entries.length}`;
  }};
  // Parent packages must finish before nested dependencies create their directories.
  await install();
 }
 async prepare(){
  if(this.job?.running)throw new Error('正在准备另一项操作');
  this.job={running:true,phase:'检查官方版本',detail:'',started:Date.now()};
  let stage;
  try{
   const latest=await this.check();const target=this.root(latest.commit);if(fs.existsSync(path.join(target,'.apk-ready.json'))){this.state.staged=latest.commit;this.write();return latest.commit;}
   stage=safePath(this.directory,'staging-'+crypto.randomBytes(8).toString('hex'));await fsp.mkdir(stage,{recursive:true});this.job.stage=path.basename(stage);
   this.job.phase='下载官方程序';const archive=await download('https://codeload.github.com/SillyTavern/SillyTavern/zip/'+latest.commit,['codeload.github.com']);
   const archiveSha256=crypto.createHash('sha256').update(archive).digest('hex');this.job.phase='展开与校验';await extractZip(archive,stage,this.require('yauzl'));
   const pkg=JSON.parse(await fsp.readFile(path.join(stage,'package.json'),'utf8'));if(pkg.name!=='sillytavern'||!fs.existsSync(path.join(stage,'server.js')))throw new Error('更新包不是有效的酒馆程序');
   this.job.phase='准备运行依赖';await this.dependencies(stage);await patchRuntime(stage,this.baseRoot);
   await fsp.writeFile(path.join(stage,'.apk-ready.json'),JSON.stringify({commit:latest.commit,version:pkg.version,archiveSha256,preparedAt:Date.now(),installScriptsExecuted:false}));
   if(fs.existsSync(target))throw new Error('目标版本存在未完成的内容，请先清理失败下载');
   await fsp.mkdir(path.dirname(target),{recursive:true});await fsp.rename(stage,target);this.state.staged=latest.commit;this.state.lastError=null;this.write();this.job.phase='准备完成';return latest.commit;
  }catch(error){if(stage&&stage.startsWith(this.directory+path.sep))await fsp.rm(stage,{recursive:true,force:true}).catch(()=>{});this.state.lastError=error.message;this.write();this.job.phase='准备失败';this.job.error=error.message;throw error;}
  finally{this.job.running=false;this.job.completed=Date.now();}
 }
 async activate(){
  if(this.job?.running)throw new Error('下载仍在进行');const target=this.state.staged;if(!target||!fs.existsSync(path.join(this.root(target),'.apk-ready.json')))throw new Error('没有可用的更新');
  if(target===this.state.active)throw new Error('当前版本已经启用');
  const id='before-'+Date.now();const backup=safePath(this.directory,'backups/'+id);await fsp.mkdir(backup,{recursive:true});
  await fsp.cp(path.join(this.baseRoot,'data'),path.join(backup,'data'),{recursive:true});await fsp.copyFile(path.join(this.baseRoot,'config.yaml'),path.join(backup,'config.yaml'));
  const globalExtensions=path.join(this.baseRoot,'.android-global-extensions');
  if(fs.existsSync(globalExtensions))await fsp.cp(globalExtensions,path.join(backup,'global-extensions'),{recursive:true});
  this.state.backup=id;this.state.previous=this.state.active;this.state.active=target;this.state.pending={attempts:0,started:Date.now()};this.write();return this.status();
 }
 rollback(){if(!this.state.previous)throw new Error('没有可回滚的版本');const current=this.state.active;this.state.active=this.state.previous;this.state.previous=current;this.state.pending=null;this.state.lastError=null;this.write();return this.status();}
 beginBoot(){
  let root;try{root=this.root(this.state.active);if(this.state.active!=='bundled'&&!fs.existsSync(path.join(root,'.apk-ready.json')))throw new Error('版本文件缺失');}catch{this.state.active='bundled';this.state.pending=null;this.state.lastError='版本文件无效，已恢复 APK 内置版本';this.write();root=this.baseRoot;}
  if(this.state.pending?.attempts>=1){this.state.lastError='更新版本上次启动未通过健康检查，已恢复上一版本';this.state.active=this.state.previous||'bundled';this.state.pending=null;this.write();root=this.root(this.state.active);}
  if(this.state.pending){this.state.pending.attempts++;this.write();}return root;
 }
 healthy(){if(this.state.pending){this.state.pending=null;this.write();}}
 failedBoot(){if(!this.state.pending)return false;this.state.active=this.state.previous||'bundled';this.state.pending=null;this.state.lastError='更新启动失败，已恢复上一版本';this.write();return true;}
}
