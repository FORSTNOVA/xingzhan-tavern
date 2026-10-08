import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {checkAppRelease} from './android-updates.mjs';
const origin='http://127.0.0.1:8788';
export function managementHandler(manager){
 const token=crypto.randomBytes(32).toString('hex');let changing=false;
 const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return async(req,res)=>{
  const pathname=new URL(req.url,origin).pathname;if(!pathname.startsWith('/manage'))return false;
  res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'");
  if(!['127.0.0.1:8788','localhost:8788'].includes(req.headers.host)){send(res,403,{error:'无效的本地地址'});return true;}
  if(pathname==='/manage'&&req.method==='GET'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   res.end(fs.readFileSync(path.join(manager.baseRoot,'android-management.html'),'utf8').replace('__MANAGEMENT_TOKEN__',token));return true;
  }
  if(req.headers['x-apk-management']!==token||(req.headers.origin&&req.headers.origin!==origin)){send(res,403,{error:'请从应用的管理页面操作'});return true;}
  try{
   if(pathname==='/manage/api/status'&&req.method==='GET'){send(res,200,manager.status());return true;}
   if(pathname==='/manage/api/app-release'&&req.method==='GET'){send(res,200,await checkAppRelease());return true;}
   if(req.method!=='POST'){send(res,405,{error:'无效的操作'});return true;}
   if(changing)throw new Error('版本切换正在进行');
   if(pathname==='/manage/api/check')send(res,200,await manager.check());
   else if(pathname==='/manage/api/prepare'){manager.prepare().catch(error=>console.warn('Android update preparation:',error.message));send(res,202,manager.status());}
   else if(pathname==='/manage/api/auto'){manager.state.autoCheck=!manager.state.autoCheck;manager.write();send(res,200,manager.status());}
   else if(['/manage/api/activate','/manage/api/rollback'].includes(pathname)){
    const state=globalThis.__apkMaintenance ||= {generations:0,changing:false};if(state.generations)throw new Error('请先等待当前回复完成或停止生成');
    changing=true;state.changing=true;
    try{const result=pathname.endsWith('/activate')?await manager.activate():manager.rollback();send(res,200,{...result,restartRequired:true});}
    catch(error){changing=false;state.changing=false;throw error;}
   }else send(res,404,{error:'未找到操作'});
  }catch(error){send(res,409,{error:error.message});}
  return true;
 };
}
