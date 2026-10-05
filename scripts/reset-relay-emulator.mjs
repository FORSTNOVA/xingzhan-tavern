import {connect} from './webview-cdp.mjs';
const c=await connect();try{
console.log(await c.evaluate(`(async()=>{const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');for(const kind of ['tts','image'])await m.mediaRequest('config/'+kind,{base:'https://tingleis.dpdns.org',removeKey:true,channel:'AI Studio',...(kind==='tts'?{voice:'Kore',style:''}:{resolution:'1K'})});return '模拟器测试令牌已删除，恢复用户中转地址';})()`));
}finally{c.close();}

