import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const c=await connect();const passed=[];
const click=async(selector)=>{const point=await c.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await c.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await c.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await wait(2000); // Let the persisted provider finish loading after APK restart.
 const data=fs.readFileSync('artifacts/relay/emulator-tts.wav').toString('base64');
 await c.evaluate(`(()=>{window.__selectionTest={calls:[],selectionEnabled:true,fetch:window.fetch};window.__selectionTestData=${JSON.stringify(data)};const p=document.createElement('div');p.id='selection-tts-fixture';p.className='mes_text';p.textContent='前面的文字。只朗读这句话。后面的文字。';p.style='position:fixed;top:110px;left:10px;background:#222;color:white;z-index:10010;padding:12px;max-width:300px';document.body.append(p);window.fetch=async(...args)=>{if(String(args[0]).includes('/api/android/media/generate-tts')){window.__selectionTest.calls.push(JSON.parse(args[1].body));await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,200);args[1].signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));},{once:true});});return new Response(Uint8Array.from(atob(window.__selectionTestData),c=>c.charCodeAt(0)),{headers:{'Content-Type':'audio/wav'}});}return window.__selectionTest.fetch.apply(window,args);};})()`);
 const select=()=>c.evaluate(`(()=>{const node=document.querySelector('#selection-tts-fixture').firstChild;const range=document.createRange();const start=node.textContent.indexOf('只朗读');range.setStart(node,start);range.setEnd(node,start+'只朗读这句话。'.length);window.getSelection().removeAllRanges();window.getSelection().addRange(range);})()`);
 await select();await wait(300);assert.equal(await c.evaluate(`document.querySelector('#xingzhan-selection-tts').hidden`),false);passed.push('聊天文本选中后显示朗读入口');
 const bounds=await c.evaluate(`(()=>{const r=document.querySelector('#xingzhan-selection-tts').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};})()`);assert.ok(bounds.top>=0&&bounds.bottom<=bounds.height,'主题下按钮超出视口');passed.push('梅花主题下入口位于可见视口');await click('#xingzhan-selection-tts');await wait(300);
 assert.deepEqual(await c.evaluate(`({open:document.querySelector('#xingzhan-tts-confirm').open,text:document.querySelector('#xingzhan-tts-confirm textarea').value,calls:window.__selectionTest.calls.length})`),{open:true,text:'只朗读这句话。',calls:0});passed.push('确认窗口只包含选中文本，打开时不发起生成');
 const clip=await c.evaluate(`(()=>{const r=document.querySelector('#xingzhan-tts-confirm').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()`);const shot=await c.call('Page.captureScreenshot',{format:'png',clip});fs.writeFileSync('artifacts/relay/selection-confirm-phone.png',Buffer.from(shot.data,'base64'));
 await click('#xingzhan-tts-confirm [data-close]');await wait(150);assert.equal(await c.evaluate('window.__selectionTest.calls.length'),0);passed.push('取消确认不请求 TTS');
 await select();await wait(250);await click('#xingzhan-selection-tts');await wait(250);await click('#xingzhan-tts-confirm [data-confirm]');
 await wait(1600);let status=await c.evaluate(`document.querySelector('#xingzhan-tts-confirm [data-status]').textContent`);if(status.includes('点击播放')){await click('#xingzhan-tts-confirm [data-confirm]');await wait(1400);status=await c.evaluate(`document.querySelector('#xingzhan-tts-confirm [data-status]').textContent`);}
 assert.equal(status,'朗读完成');assert.deepEqual(await c.evaluate('window.__selectionTest.calls'),[{input:'只朗读这句话。',voice:'Kore'}]);passed.push('手动确认仅请求一次选中文本，模拟音频实际播放完成');
 await click('#xingzhan-tts-confirm [data-confirm]');await wait(1200);assert.equal(await c.evaluate('window.__selectionTest.calls.length'),1);passed.push('再次播放复用音频，不重复生成');
 await click('#xingzhan-tts-confirm [data-close]');await select();await wait(250);await click('#xingzhan-selection-tts');await wait(250);await click('#xingzhan-tts-confirm [data-confirm]');await click('#xingzhan-tts-confirm [data-close]');await wait(350);assert.equal(await c.evaluate(`document.querySelector('#xingzhan-tts-confirm').open`),false);passed.push('生成期间停止并关闭，无自动重试');
 fs.writeFileSync('artifacts/relay/selection-phone.json',JSON.stringify({passed,upstream:'stubbed in WebView; no real generation calls'},null,2));console.log({passed});
}finally{
 await c.evaluate(`(()=>{document.querySelector('#xingzhan-tts-confirm')?.close();document.querySelector('#selection-tts-fixture')?.remove();if(window.__selectionTest){window.fetch=window.__selectionTest.fetch;}window.getSelection()?.removeAllRanges();delete window.__selectionTest;delete window.__selectionTestData;})()`);c.close();
}


