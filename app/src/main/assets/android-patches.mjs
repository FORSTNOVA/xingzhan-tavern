import fs from 'node:fs/promises';
import path from 'node:path';
import { patchMedia } from './android-media-patches.mjs';
async function shareGlobalExtensions(root,baseRoot){
 const shared=path.join(baseRoot,'.android-global-extensions');await fs.mkdir(shared,{recursive:true});
 const original=path.join(root,'public/scripts/extensions/third-party');await fs.mkdir(path.dirname(original),{recursive:true});
 let stat;try{stat=await fs.lstat(original);}catch{}
 if(stat?.isSymbolicLink()){
  if(await fs.realpath(original)!==await fs.realpath(shared))throw new Error('全局扩展目录链接异常');return;
 }
 if(stat){
  if(!stat.isDirectory())throw new Error('全局扩展目录不是文件夹');
  for(const name of await fs.readdir(original)){const destination=path.join(shared,name);try{await fs.lstat(destination);}catch{await fs.cp(path.join(original,name),destination,{recursive:true});}}
  // Keep the original as a recoverable migration copy, rather than deleting it.
  await fs.rename(original,original+'.before-apk-sharing-'+Date.now());
 }
 await fs.symlink(shared,original,process.platform==='win32'?'junction':'dir');
}
export async function patchRuntime(root,assetRoot){
 await patchMedia(root,assetRoot);
 if(path.resolve(root)!==path.resolve(assetRoot))for(const name of ['android-git.mjs','android-routes.mjs','android-downloads.js','android-probe.html'])await fs.copyFile(path.join(assetRoot,name),path.join(root,name));
 const extensions=path.join(root,'src/endpoints/extensions.js');let text=await fs.readFile(extensions,'utf8');
 const original="import { CheckRepoActions, default as simpleGit } from 'simple-git';";
 const replacement="import { CheckRepoActions, androidGit as simpleGit } from '../../android-git.mjs';";
 if(!text.includes(original)&&!text.includes(replacement))throw new Error('新版本扩展接口已变化，需更新 APK 后再升级');
 if(text.includes(original))await fs.writeFile(extensions,text.replace(original,replacement));
 const server=path.join(root,'src/server-main.js');text=await fs.readFile(server,'utf8');
 if(!text.includes('installAndroidRoutes(app)')){
  if(!text.includes('function apply404Middleware() {'))throw new Error('新版本服务器接口已变化，需更新 APK 后再升级');
  text="import {installAndroidRoutes, trackAndroidRequests} from '../android-routes.mjs';\n"+text.replace('function apply404Middleware() {','function apply404Middleware() {\n    installAndroidRoutes(app);').replace('setupPrivateEndpoints(app);','app.use(trackAndroidRequests);\nsetupPrivateEndpoints(app);');
  await fs.writeFile(server,text);
 }
 await shareGlobalExtensions(assetRoot,assetRoot);
 if(path.resolve(root)!==path.resolve(assetRoot))await shareGlobalExtensions(root,assetRoot);
}
