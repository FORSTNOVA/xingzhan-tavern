import {execFileSync} from 'node:child_process';
const adb='C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';let found=false;
for(let n=0;n<80;n++){
 try{const pid=execFileSync(adb,['-s','ca168055','shell','pidof','cn.jiuguan.probe'],{encoding:'utf8'}).trim();if(pid&&/^\d+$/.test(pid)){execFileSync(adb,['-s','ca168055','forward','tcp:19222','localabstract:webview_devtools_remote_'+pid]);const targets=await(await fetch('http://127.0.0.1:19222/json/list')).json();if(targets.some(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:'))){found=true;console.log(JSON.stringify({ready:true,pid}));break;}}}catch{}
 await new Promise(r=>setTimeout(r,250));
}if(!found)throw Error('Phone WebView did not become ready');
