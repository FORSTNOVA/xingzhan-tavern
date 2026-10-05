import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();const operation=process.argv[2]||'install';
try{
 async function api(route,body){return c.evaluate(`(async()=>{const {token}=await(await fetch('/csrf-token')).json();const r=await fetch('/api/extensions/${route}',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(${JSON.stringify(body)})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {http:r.status,data};})()`);}
 const info={extensionName:'apk-fixture',global:false};let results={};
 if(operation==='install'){
  results.install=await api('install',{url:'http://127.0.0.1:18889/apk-fixture.git',global:false,branch:'main'});
  results.version=await api('version',info);results.branches=await api('branches',info);
 }else if(operation==='update'){
  results.publish=await(await fetch('http://127.0.0.1:18889/publish-v2',{method:'POST'})).json();
  results.before=await api('version',info);results.update=await api('update',info);results.after=await api('version',info);
  results.alternate=await api('switch',{...info,branch:'origin/alternate'});results.alternateVersion=await api('version',info);
  results.main=await api('switch',{...info,branch:'main'});results.mainVersion=await api('version',info);
 }else if(operation==='remove')results.remove=await api('delete',info);
 else if(operation==='global-install')results.install=await api('install',{url:'http://127.0.0.1:18889/apk-fixture.git',global:true,branch:'main'});
 else if(operation==='global-version')results.version=await api('version',{...info,global:true});
 else if(operation==='global-remove')results.remove=await api('delete',{...info,global:true});
 else throw Error('Unknown operation');
 fs.writeFileSync('artifacts/features/extension-'+operation+'.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 if(Object.values(results).some(r=>r.http&&r.http>=400))process.exitCode=1;
}finally{c.close();}
