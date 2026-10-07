import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {encodeLocalDreamRgbPng,readLocalDreamSse} from '../app/src/main/assets/localdream-codec.mjs';

const rgb=Buffer.from([255,0,0,0,255,0]);
const png=encodeLocalDreamRgbPng(rgb.toString('base64'),2,1,3);
assert.deepEqual(png.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
let offset=8,idat;
while(offset<png.length){const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);if(type==='IDAT')idat=png.subarray(offset+8,offset+8+length);offset+=12+length;}
assert.ok(idat);
assert.deepEqual(inflateSync(idat),Buffer.from([0,255,0,0,0,255,0]));
assert.throws(()=>encodeLocalDreamRgbPng(rgb.toString('base64'),3,1,3),/长度不匹配/);

const payload={type:'complete',image:rgb.toString('base64'),width:2,height:1,channels:3,seed:7};
const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('event: progress\ndata: {"type":"progress","step":1}\n\nevent: complete\ndata: '+JSON.stringify(payload).slice(0,35)));controller.enqueue(new TextEncoder().encode(JSON.stringify(payload).slice(35)+'\n\n'));controller.close();}});
assert.deepEqual(await readLocalDreamSse(new Response(stream,{headers:{'content-type':'text/event-stream'}})),payload);

const errorStream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('event: error\ndata: {"type":"error","message":"QNN unavailable"}\n\n'));controller.close();}});
await assert.rejects(()=>readLocalDreamSse(new Response(errorStream,{headers:{'content-type':'text/event-stream'}})),/QNN unavailable/);
console.log('Local Dream bridge: SSE completion/error parsing and raw-RGB PNG conversion passed.');
