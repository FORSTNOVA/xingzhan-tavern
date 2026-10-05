import {execFileSync} from 'node:child_process';
const adb='C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
function run(args){return execFileSync(adb,['-s','ca168055',...args],{encoding:'utf8'}).trim();}
run(['shell','uiautomator','dump','/data/local/tmp/apk-feature-ui.xml']);const xml=run(['shell','cat','/data/local/tmp/apk-feature-ui.xml']);
const nodes=[...xml.matchAll(/<node\b([^>]+)>/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2].replace(/&amp;/g,'&').replace(/&quot;/g,'"')])));
const action=process.argv[2]||'snapshot';
if(action==='snapshot')console.log(JSON.stringify(nodes.filter(n=>n.text||n['content-desc']).map(n=>({text:n.text,description:n['content-desc'],id:n['resource-id'],bounds:n.bounds})),null,2));
else if(action==='tap'){
 const wanted=process.argv[3];const node=nodes.find(n=>n.text===wanted||n.text?.replace(/&#10;|\n|\r/g,'')===wanted||n['content-desc']===wanted||n['resource-id']===wanted);if(!node)throw Error('UI item missing: '+wanted);
 const values=node.bounds.match(/\d+/g).map(Number);run(['shell','input','tap',String(Math.round((values[0]+values[2])/2)),String(Math.round((values[1]+values[3])/2))]);console.log(JSON.stringify({tapped:wanted}));
}else throw Error('Unknown UI action');
