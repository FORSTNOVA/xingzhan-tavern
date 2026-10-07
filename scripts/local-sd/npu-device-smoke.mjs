import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {encodeLocalDreamRgbPng, readLocalDreamSse} from '../../app/src/main/assets/localdream-codec.mjs';

const baseUrl=process.env.LOCAL_NPU_URL||'http://127.0.0.1:28081';
const response=await fetch(`${baseUrl}/generate`,{
 method:'POST',
 headers:{'content-type':'application/json'},
 body:JSON.stringify({
  prompt:'anime portrait, a calm girl with silver hair wearing a blue kimono, moonlit garden, detailed eyes, high quality',
  negative_prompt:'low quality, blurry, malformed hands, text, watermark',
  width:512,height:512,steps:8,cfg:7.0,seed:20261007,
  scheduler:'dpm',output_format:'raw',preview_format:'raw',
 }),
 signal:AbortSignal.timeout(180_000),
});
if(!response.ok)throw new Error(`generation endpoint returned HTTP ${response.status}: ${(await response.text()).slice(0,400)}`);
const result=await readLocalDreamSse(response);
assert.equal(result.width,512);
assert.equal(result.height,512);
assert.equal(result.channels,3);
const png=encodeLocalDreamRgbPng(result.image,result.width,result.height,result.channels);
const output='artifacts/local-npu-smoke/anythingv5-npu.png';
await mkdir('artifacts/local-npu-smoke',{recursive:true});
await writeFile(output,png);
console.log(JSON.stringify({ok:true,seed:result.seed,width:result.width,height:result.height,generationTimeMs:result.generation_time_ms,firstStepMs:result.first_step_time_ms,pngBytes:png.length,output}));
