import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';
const c=await connect();try{
 console.log(await c.evaluate(`(()=>{document.querySelector('#xingzhan-synthesis [data-open-speech]').click();const dialog=document.querySelector('#xingzhan-speech-dialog'),rect=dialog.getBoundingClientRect();return {open:dialog.open,width:rect.width,viewport:innerWidth,fits:rect.left>=0&&rect.right<=innerWidth};})()`));
 const shot=await c.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/relay/synthesis-front-dialog.png',Buffer.from(shot.data,'base64'));
}finally{c.close();}
