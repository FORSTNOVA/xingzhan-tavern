import fs from 'node:fs';

const file = 'app/src/main/assets/android-media.mjs';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const oldDiag = `  if(kind==='image'&&config.source==='local'){
   const target=(config.localUrl||'http://127.0.0.1:8789').replace(/\\/+$/,'');
   try{`;

const newDiag = `  if(kind==='image'&&config.source==='local'){
   const target=(config.localUrl||'http://127.0.0.1:8789').replace(/\\/+$/,'');
   await ensureLocalEngineServer(req, target);
   try{`;

if (content.includes(oldDiag)) {
  content = content.replace(oldDiag, newDiag);
  console.log('Patched diagnostics in android-media.mjs');
  fs.writeFileSync(file, content, 'utf8');
} else {
  console.log('oldDiag already patched or not found');
}
