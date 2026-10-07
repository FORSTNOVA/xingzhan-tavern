import {deflateSync} from 'node:zlib';

export async function readLocalDreamSse(response, signal) {
 const contentType=String(response.headers.get('content-type')||'').toLowerCase();
 if(!contentType.includes('text/event-stream')){
  const body=await response.text().catch(()=> '');let message='';
  try{const data=JSON.parse(body);message=String(data?.error?.message||data?.message||data?.error||'');}catch{}
  throw Error(message||('Local Dream 没有返回 SSE 图像流：'+body.slice(0,240)));
 }
 const reader=response.body?.getReader();if(!reader)throw Error('Local Dream SSE 响应缺少数据流');
 const decoder=new TextDecoder();let pending='';
 try{
  while(true){
   if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
   const {value,done}=await reader.read();pending+=decoder.decode(value||new Uint8Array(),{stream:!done});
   if(pending.length>24*1024*1024)throw Error('Local Dream SSE 响应超过大小限制');
   let split;
   while((split=pending.search(/\r?\n\r?\n/))!==-1){
    const block=pending.slice(0,split);pending=pending.slice(split+(pending[split]==='\r'?4:2));
    const event=block.split(/\r?\n/).find(line=>line.startsWith('event:'))?.slice(6).trim()||'';
    const data=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if(!data)continue;
    let payload;try{payload=JSON.parse(data);}catch{throw Error('Local Dream 返回了无法解析的 SSE 数据');}
    const type=payload.type||event;
    if(type==='error'||event==='error')throw Error(String(payload.message||payload.error||'Local Dream NPU 推理失败').slice(0,400));
    if(type==='complete'||event==='complete')return payload;
   }
   if(done)break;
  }
 }finally{try{await reader.cancel();}catch{}}
 throw Error('Local Dream SSE 流结束，但没有收到完成事件');
}

export function encodeLocalDreamRgbPng(base64,width,height,channels=3){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||channels!==3)throw Error('Local Dream 返回了无效的 RGB 图像尺寸');
 const pixels=Buffer.from(String(base64||''),'base64'),rowBytes=width*3;
 if(pixels.length!==rowBytes*height)throw Error('Local Dream RGB 数据长度不匹配：期望 '+(rowBytes*height)+'，实际 '+pixels.length);
 const scanlines=Buffer.alloc((rowBytes+1)*height);
 for(let y=0;y<height;y++)pixels.copy(scanlines,y*(rowBytes+1)+1,y*rowBytes,(y+1)*rowBytes);
 let table=encodeLocalDreamRgbPng.crcTable;
 if(!table){table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}encodeLocalDreamRgbPng.crcTable=table;}
 const chunk=(name,data)=>{const type=Buffer.from(name,'ascii'),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);type.copy(out,4);data.copy(out,8);let crc=0xffffffff;for(let i=4;i<8+data.length;i++)crc=table[(crc^out[i])&0xff]^(crc>>>8);out.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);return out;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]);
}
