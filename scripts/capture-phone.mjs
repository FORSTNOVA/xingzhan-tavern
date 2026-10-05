import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path=process.argv[2];
if(!path?.startsWith('artifacts/'))throw new Error('Provide a workspace artifacts path');
const png=execFileSync('C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s','ca168055','exec-out','screencap','-p'],{timeout:15000,maxBuffer:12*1024*1024});
fs.writeFileSync(path,png);
console.log(JSON.stringify({path,bytes:png.length}));
