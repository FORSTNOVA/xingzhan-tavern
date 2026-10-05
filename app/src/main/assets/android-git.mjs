import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const git=require('isomorphic-git');
const http=require('isomorphic-git/http/node');
export const CheckRepoActions={IS_REPO_ROOT:'root'};
const locks=new Map();
async function exclusive(dir,action){
 if(locks.has(dir))throw new Error('此扩展正在进行另一项 Git 操作，请稍后重试');
 locks.set(dir,true);try{return await action();}finally{locks.delete(dir);}
}
export function androidGit({baseDir}){
 const dir=path.resolve(baseDir);const options={fs,http,dir};
 async function clean(){const rows=await git.statusMatrix(options);if(rows.some(([,head,work,stage])=>head!==work||head!==stage))throw new Error('扩展存在本地改动，已停止更新以免覆盖');}
 async function branches(remote=false){
  const names=await git.listBranches({...options,...(remote?{remote:'origin'}:{})});
  const current=await git.currentBranch(options);const result={current,all:[],branches:{}};
  for(const ref of names.filter(n=>n!=='HEAD')){const name=remote?'origin/'+ref:ref;const oid=await git.resolveRef({...options,ref:remote?'refs/remotes/origin/'+ref:ref});result.all.push(name);result.branches[name]={name,current:!remote&&name===current,commit:oid.slice(0,7),label:name};}
  return result;
 }
 return {
  async checkIsRepo(){return fs.existsSync(path.join(dir,'.git','HEAD'));},
  async revparse(args){if(args[0]==='--is-shallow-repository')return String(fs.existsSync(path.join(dir,'.git','shallow'))&&fs.readFileSync(path.join(dir,'.git','shallow'),'utf8').trim().length>0);return git.resolveRef({...options,ref:args[0]});},
  async branch(args=[]){return branches(args.includes('-r'));},
  async branchLocal(){return branches();},
  async getRemotes(){return (await git.listRemotes(options)).map(r=>({name:r.remote,refs:{fetch:r.url,push:r.url}}));},
  async fetch(remote='origin',args=[]){return exclusive(dir,()=>git.fetch({...options,remote,singleBranch:false,prune:true,...(args.includes('--unshallow')?{depth:2147483647}:{}),onAuth:()=>({cancel:true})}));},
  async log({from,to}){const target=await git.resolveRef({...options,ref:to});return {total:target===from?0:1,all:[]};},
  async remote(args){if(args[0]==='set-branches'&&args[1]==='origin'&&args[2]==='*')return;throw new Error('不支持的 Git remote 操作');},
  async pull(remote='origin',ref){return exclusive(dir,async()=>{await clean();await git.pull({...options,remote,ref,singleBranch:false,fastForwardOnly:true,author:{name:'Android Tavern',email:'local@localhost'},onAuth:()=>({cancel:true})});return {summary:{changes:1}};});},
  async checkout(ref){return exclusive(dir,async()=>{await clean();await git.checkout({...options,ref,force:false});});},
  async checkoutBranch(ref,start){return exclusive(dir,async()=>{await clean();const oid=await git.resolveRef({...options,ref:start});await git.writeRef({...options,ref:'refs/heads/'+ref,value:oid});await git.setConfig({...options,path:`branch.${ref}.remote`,value:'origin'});await git.setConfig({...options,path:`branch.${ref}.merge`,value:`refs/heads/${ref}`});await git.checkout({...options,ref,force:false});});},
 };
}
