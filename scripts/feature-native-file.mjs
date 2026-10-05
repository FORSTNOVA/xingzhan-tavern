import {execFileSync} from 'node:child_process';import fs from 'node:fs';
const adb='C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
let value,found=false;for(let n=0;n<100;n++){
 try{value=JSON.parse(execFileSync(adb,['-s','ca168055','exec-out','run-as','cn.jiuguan.probe','cat','files/file-validation.json'],{encoding:'utf8'}));}catch{}
 if((!process.argv[2]||value?.stage===process.argv[2])&&(!process.argv[3]||value?.message?.includes(process.argv[3]))){found=true;break;}await new Promise(r=>setTimeout(r,200));
}if(!found)throw Error('Native file callback did not arrive');if(process.env.FEATURE_OUTPUT)fs.writeFileSync(process.env.FEATURE_OUTPUT,JSON.stringify(value,null,2));console.log(JSON.stringify(value));
