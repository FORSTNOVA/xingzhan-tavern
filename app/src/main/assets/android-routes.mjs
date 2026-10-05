import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { installMediaRoutes } from './android-media.mjs';
const root=path.dirname(import.meta.filename);
export function trackAndroidRequests(req,res,next){
 const state=globalThis.__apkMaintenance ||= {generations:0,changing:false};
 if(state.changing&&req.path.startsWith('/api/')&&req.method!=='GET')return res.status(503).send('酒馆正在切换版本，请稍后重试');
 if(!req.path.startsWith('/api/')||!req.path.includes('/generate'))return next();
 if(state.changing)return res.status(503).send('酒馆正在切换版本，请稍后重试');
 state.generations++;let done=false;const finish=()=>{if(!done){done=true;state.generations--;}};
 res.once('close',finish);res.once('finish',finish);next();
}
export function installAndroidRoutes(app){
 installMediaRoutes(app);
 const directory=path.join(process.env.APK_BASE_ROOT || root,'.android-downloads');fs.mkdirSync(directory,{recursive:true});
 for(const name of fs.readdirSync(directory))if(/^[a-f0-9]{64}\.json$/.test(name)){try{const metadata=JSON.parse(fs.readFileSync(path.join(directory,name)));if(Date.now()-metadata.created>86400000){fs.rmSync(path.join(directory,name));fs.rmSync(path.join(directory,name.replace('.json','.bin')),{force:true});}}catch{}}
 app.post('/api/android/download',express.raw({type:'application/octet-stream',limit:'128mb'}),(req,res)=>{
  if(!req.user || !Buffer.isBuffer(req.body))return res.sendStatus(403);
  let filename;try{filename=decodeURIComponent(String(req.headers['x-apk-filename']||'download.bin'));}catch{return res.sendStatus(400);}
  filename=path.basename(filename.replaceAll('\\','/')).replace(/[\x00-\x1f]/g,'').slice(0,180)||'download.bin';
  const mime=String(req.headers['x-apk-mime']||'application/octet-stream');if(!/^[\w.+-]+\/[\w.+-]+$/.test(mime))return res.sendStatus(400);
  const token=crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(directory,token+'.bin'),req.body);
  fs.writeFileSync(path.join(directory,token+'.json'),JSON.stringify({filename,mime,user:req.user.profile.handle,created:Date.now()}));
  res.json({url:'/api/android/download/'+token,size:req.body.length});
 });
 app.get('/api/android/download/:token',(req,res)=>{
  const token=req.params.token;if(!/^[a-f0-9]{64}$/.test(token)||!req.user)return res.sendStatus(404);
  try{
   const meta=JSON.parse(fs.readFileSync(path.join(directory,token+'.json')));if(meta.user!==req.user.profile.handle)return res.sendStatus(403);
   res.set('Content-Type',meta.mime);res.set('Cache-Control','no-store');res.set('Content-Disposition',`attachment; filename="download.bin"; filename*=UTF-8''${encodeURIComponent(meta.filename)}`);
   res.sendFile(path.join(directory,token+'.bin'));
  }catch{res.sendStatus(404);}
 });
 app.get('/android-probe',(req,res)=>{if(!req.user)return res.sendStatus(403);res.type('html').send(fs.readFileSync(path.join(root,'android-probe.html'),'utf8'));});
}
