import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {safePath,verifyIntegrity,UpdateManager,extractZip,extractPackage} from '../app/src/main/assets/android-updates.mjs';
import {androidGit} from '../app/src/main/assets/android-git.mjs';
import {patchRuntime} from '../app/src/main/assets/android-patches.mjs';
const require=createRequire(path.resolve('vendor/SillyTavern/package.json'));
const root=path.resolve('artifacts/features/core-tests-'+Date.now());fs.mkdirSync(root,{recursive:true});const passed=[];
for(const value of ['../escape','dir/../../escape','C:/escape','/escape','dir\\escape','dir\0escape'])assert.throws(()=>safePath(root,value));passed.push('archive path traversal rejected');
const bytes=Buffer.from('verified');const integrity='sha512-'+crypto.createHash('sha512').update(bytes).digest('base64');verifyIntegrity(bytes,integrity);assert.throws(()=>verifyIntegrity(Buffer.from('tampered'),integrity));passed.push('dependency tampering rejected');
const tar=require('tar-stream');const pack=tar.pack();const chunks=[];pack.on('data',c=>chunks.push(c));const done=new Promise(r=>pack.on('end',r));pack.entry({name:'package/value.txt'},'valid');pack.finalize();await done;
await extractPackage(require('node:zlib').gzipSync(Buffer.concat(chunks)),path.join(root,'package'),tar);assert.equal(fs.readFileSync(path.join(root,'package/value.txt'),'utf8'),'valid');passed.push('dependency archive extraction');
const hostile=tar.pack();const hostileChunks=[];hostile.on('data',c=>hostileChunks.push(c));const hostileDone=new Promise(r=>hostile.on('end',r));hostile.entry({name:'package/../../escape'},'evil');hostile.finalize();await hostileDone;await assert.rejects(extractPackage(require('node:zlib').gzipSync(Buffer.concat(hostileChunks)),path.join(root,'hostile'),tar));passed.push('malicious dependency path rejected');
const zip=require('archiver')('zip');const zipChunks=[];zip.on('data',c=>zipChunks.push(c));const zipDone=new Promise(r=>zip.on('end',r));zip.append('valid',{name:'release/server.js'});await zip.finalize();await zipDone;await extractZip(Buffer.concat(zipChunks),path.join(root,'zip'),require('yauzl'));assert.equal(fs.readFileSync(path.join(root,'zip/server.js'),'utf8'),'valid');passed.push('source archive extraction');
fs.writeFileSync(path.join(root,'package.json'),'{}');fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'data/chat'),'preserve');fs.writeFileSync(path.join(root,'config.yaml'),'test: true');
const manager=new UpdateManager(root);const commit='1'.repeat(40);fs.mkdirSync(manager.root(commit),{recursive:true});fs.writeFileSync(path.join(manager.root(commit),'.apk-ready.json'),'{}');manager.state.staged=commit;await manager.activate();assert.equal(manager.state.active,commit);manager.beginBoot();assert.equal(manager.failedBoot(),true);assert.equal(manager.state.active,'bundled');assert.equal(fs.readFileSync(path.join(root,'data/chat'),'utf8'),'preserve');passed.push('failed boot rollback preserves data');
manager.state.active=commit;manager.state.previous='bundled';manager.state.pending={attempts:1};manager.beginBoot();assert.equal(manager.state.active,'bundled');passed.push('interrupted boot rollback');manager.state.active='../invalid';manager.beginBoot();assert.equal(manager.state.active,'bundled');passed.push('invalid release fallback');
const clone=path.join(root,'extension');await require('isomorphic-git').clone({fs,http:require('isomorphic-git/http/node'),dir:clone,url:'http://127.0.0.1:18889/apk-fixture.git',depth:1,ref:'main'});const adapter=androidGit({baseDir:clone});await adapter.fetch('origin',['--unshallow']);await adapter.checkoutBranch('alternate','origin/alternate');assert.equal(JSON.parse(fs.readFileSync(path.join(clone,'manifest.json'))).version,'3');await adapter.checkout('main');fs.appendFileSync(path.join(clone,'index.js'),'// changed');await assert.rejects(adapter.checkout('alternate'),/本地改动/);passed.push('extension branch switching and dirty file protection');
const release=manager.root(commit);
for(const directory of [root,release]){
 fs.mkdirSync(path.join(directory,'src/endpoints'),{recursive:true});fs.writeFileSync(path.join(directory,'src/endpoints/extensions.js'),"import { CheckRepoActions, default as simpleGit } from 'simple-git';");
 fs.writeFileSync(path.join(directory,'src/server-main.js'),'setupPrivateEndpoints(app);\nfunction apply404Middleware() { }');fs.mkdirSync(path.join(directory,'public/scripts/extensions/third-party/example'),{recursive:true});fs.writeFileSync(path.join(directory,'public/scripts/extensions/third-party/example/version'),'1');
}
for(const name of ['android-git.mjs','android-routes.mjs','android-downloads.js','android-probe.html'])fs.copyFileSync(path.join('app/src/main/assets',name),path.join(root,name));
await patchRuntime(root,root);await patchRuntime(release,root);const shared=path.join(root,'.android-global-extensions/example/version');fs.writeFileSync(shared,'2');
assert.equal(fs.realpathSync(path.join(root,'public/scripts/extensions/third-party')),fs.realpathSync(path.join(release,'public/scripts/extensions/third-party')));assert.equal(fs.readFileSync(path.join(release,'public/scripts/extensions/third-party/example/version'),'utf8'),'2');await patchRuntime(root,root);assert.equal(fs.readFileSync(shared,'utf8'),'2');passed.push('global extensions shared across update and rollback without overwriting');
fs.writeFileSync('artifacts/features/core-tests.json',JSON.stringify({passed},null,2));console.log(JSON.stringify({passed}));
