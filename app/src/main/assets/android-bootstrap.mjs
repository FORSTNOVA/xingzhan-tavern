import fs from 'node:fs';
import http from 'node:http';
import util from 'node:util';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {UpdateManager} from './android-updates.mjs';
import {patchRuntime} from './android-patches.mjs';
import {managementHandler} from './android-management.mjs';

const root = path.dirname(import.meta.filename);
process.chdir(root);
const logPath = path.join(root, 'android-node.log');
for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
        try { fs.appendFileSync(logPath, `${new Date().toISOString()} ${level}: ${util.format(...args)}\n`); } catch {}
        original(...args);
    };
}
let startupError = null;
const updates=new UpdateManager(root);
const manage=managementHandler(updates);
const originalExit=process.exit;let updateGuard=false;
function rollbackStartup(error){startupError=String(error?.stack||error);console.error('Update startup failure:',error?.message||error);if(updates.failedBoot())fs.writeFileSync(path.join(root,'.apk-restart-request'),'rollback');}
function endUpdateGuard(){if(!updateGuard)return;updateGuard=false;process.exit=originalExit;process.removeListener('uncaughtException',rollbackStartup);process.removeListener('unhandledRejection',rollbackStartup);}
let task = null;
const statePath = path.join(root, 'probe-state.json');
if (fs.existsSync(statePath)) { try { task = JSON.parse(fs.readFileSync(statePath)); if (task.running) { task.running=false; task.interrupted=true; } } catch {} }
function save() { fs.writeFileSync(statePath+'.tmp', JSON.stringify(task)); fs.renameSync(statePath+'.tmp', statePath); }
const diagnostics = http.createServer(async (req, res) => {
    if(await manage(req,res))return;
    if (req.url === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({node:process.version,mobile:process.versions.mobile,platform:process.platform,arch:process.arch,pid:process.pid,startupError,task})); return;
    }
    if (req.url === '/test' && req.method === 'POST') {
        if (task?.running) { res.writeHead(409); res.end('Task already running'); return; }
        task = {id:Date.now(),running:true,startedAt:Date.now(),count:0,expected:120,text:''}; save();
        // Deliberately backend-owned: disconnecting the UI does not cancel this fixture.
        const timer = setInterval(() => {
            task.count++; task.text+=`${task.count} `;
            if (task.count>=task.expected) { task.running=false; task.completedAt=Date.now(); clearInterval(timer); }
            save();
        }, 1000);
        res.writeHead(202); res.end('Started'); return;
    }
    if (req.url === '/stream') {
        res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
        const timer=setInterval(() => res.write(`data: ${JSON.stringify(task)}\n\n`),1000);
        req.on('close', () => clearInterval(timer)); return;
    }
    if (req.url === '/log') { res.setHeader('Content-Type','text/plain; charset=utf-8'); res.end(fs.existsSync(logPath)?fs.readFileSync(logPath):''); return; }
    if (req.url !== '/') { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px sans-serif;padding:20px;background:#17212b;color:#eee}button{padding:14px;font:inherit}pre{white-space:pre-wrap;word-break:break-all}</style><h2>内嵌运行验证</h2><p>此测试使用模拟流，不调用收费模型 API。真实酒馆请求仍采用上游原有逻辑。</p><button onclick="fetch('/test',{method:'POST'}).then(refresh)">开始两分钟后台任务</button><p>开始后可切换应用或息屏，回来检查 count 是否达到 120。</p><pre id="health"></pre><pre id="stream"></pre><a style="color:#8cf" href="/log">查看酒馆启动日志</a><script>async function refresh(){document.querySelector('#health').textContent=JSON.stringify(await(await fetch('/health')).json(),null,2)}refresh();setInterval(refresh,3000);const s=new EventSource('/stream');s.onmessage=e=>document.querySelector('#stream').textContent='流式连接：'+e.data;</script>`);
});
diagnostics.listen(8788,'127.0.0.1');
console.log('Android embedded runtime', process.versions, 'pid', process.pid);
if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('SillyTavern requires Node >=20');
try {
 const active=updates.beginBoot();await patchRuntime(active,root);process.env.APK_BASE_ROOT=root;process.chdir(active);
 if(updates.state.pending){
  updateGuard=true;process.on('uncaughtException',rollbackStartup);process.on('unhandledRejection',rollbackStartup);
  // Upstream startup errors call process.exit; retain the host long enough to recover.
  process.exit=code=>{const error=new Error('Update startup requested exit '+code);rollbackStartup(error);throw error;};
 }
 process.argv = ['node', path.join(active,'server.js'), '--configPath',path.join(root,'config.yaml'),'--dataRoot',path.join(root,'data'),'--port', '8787', '--listen', 'false', '--browserLaunchEnabled', 'false', '--enableIPv6', 'false'];
 await import(pathToFileURL(path.join(active,'server.js')).href);
 let attempts=0;const timer=setInterval(async()=>{
  try{const response=await fetch('http://127.0.0.1:8787/',{signal:AbortSignal.timeout(1000)});await response.body?.cancel();if(response.ok){updates.healthy();endUpdateGuard();clearInterval(timer);return;}}catch{}
  if(++attempts>=60){clearInterval(timer);startupError='酒馆未通过启动健康检查';if(updates.failedBoot())fs.writeFileSync(path.join(root,'.apk-restart-request'),'rollback');}
 },1000);
} catch (error) { startupError=String(error.stack || error); console.error(error);if(updates.failedBoot())fs.writeFileSync(path.join(root,'.apk-restart-request'),'rollback'); }
if(updates.state.autoCheck&&Date.now()-(updates.state.checkedAt||0)>6*3600000)updates.check().catch(error=>console.warn('Official update check:',error.message));
