import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),source=path.join(root,'plugins/xingzhan-synthesis');
for(const name of ['manifest.json','index.js','media.js','style.css','system.js','kokoro-blend.js','mascot.js','mascot.png'])fs.copyFileSync(path.join(source,name),path.join(root,'app/src/main/assets','xingzhan-synthesis-'+name));
const require=createRequire(path.join(root,'vendor/SillyTavern/package.json'));const archive=require('archiver')('zip',{zlib:{level:9}});
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});const output=fs.createWriteStream(path.join(root,'artifacts/xingzhan-synthesis.zip'));archive.pipe(output);archive.on('error',error=>{throw error;});
const done=new Promise((resolve,reject)=>{output.on('close',resolve);output.on('error',reject);});archive.directory(source,'xingzhan-synthesis');await archive.finalize();await done;console.log('Packed standalone synthesis plugin');
