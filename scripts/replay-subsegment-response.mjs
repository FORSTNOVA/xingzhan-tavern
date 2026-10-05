import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {EventEmitter} from 'node:events';
import {scoreClassificationCase} from './tts-evaluation-core.mjs';
const file=process.argv[2];if(!file)throw Error('Provide recorded report.json');
const report=JSON.parse(fs.readFileSync(file)),entry=report.records.at(-1),sample=report.cases.find(x=>x.id===entry.id),raw=entry.diagnostics.at(-1).response.body;
assert.equal(entry.status,502);assert.equal(sample.id,'two-people-range');
const root=path.resolve('artifacts/tts-evaluation/replay-'+Date.now());fs.mkdirSync(path.join(root,'src/endpoints'),{recursive:true});
fs.copyFileSync('app/src/main/assets/android-media.mjs',path.join(root,'android-media.mjs'));
fs.writeFileSync(path.join(root,'src/endpoints/secrets.js'),'export const readSecret=()=>"offline-replay-placeholder";export const writeSecret=()=>{};export const deleteSecret=()=>{};');
fs.writeFileSync(path.join(root,'xingzhan-media.json'),JSON.stringify({analysis:{base:'https://offline.invalid',model:report.model}}));
const backend=await import(pathToFileURL(path.join(root,'android-media.mjs'))),routes=new Map();backend.installMediaRoutes({use(){},get(p,h){routes.set('GET '+p,h);},post(p,h){routes.set('POST '+p,h);}});
const scope='recorded-local-replay',req=body=>({body:{...body,scopeId:scope},user:{directories:{root}},params:{},query:{scope}});
function response(){const r=new EventEmitter();r.statusCode=200;r.set=()=>r;r.status=n=>{r.statusCode=n;return r;};r.json=value=>{r.result=value;r.writableEnded=true;return r;};return r;}
const saved=response();await routes.get('POST /api/android/media/session')(req(entry.sessionBefore.record),saved);assert.equal(saved.statusCode,200);
const originalFetch=globalThis.fetch;let replayCalls=0;
try{
 globalThis.fetch=async()=>{replayCalls++;return new Response(raw);};const result=response();
 await routes.get('POST /api/android/media/reanalyze')(req({sessionId:saved.result.id,range:sample.range,expectedRevision:saved.result.reviewRevision,analysisDiagnostics:true,analysisCallLimit:1}),result);
 assert.equal(result.statusCode,200,JSON.stringify(result.result));assert.equal(replayCalls,1);assert.equal(result.result.result.localFormatRecovery,'trailing-closers');assert.equal(result.result.text,sample.text);
 const selected={...result.result.result,segments:result.result.localAnalysisIndices.map(i=>result.result.result.segments[i])};let offset=0;
 const truth={...sample,text:sample.text.slice(sample.range.start,sample.range.end),expectedSpans:sample.expectedSpans.flatMap(s=>{const start=Math.max(offset,sample.range.start),end=Math.min(offset+s.text.length,sample.range.end);offset+=s.text.length;return end>start?[{...s,text:sample.text.slice(start,end)}]:[];})};
 const score=scoreClassificationCase(truth,selected,backend.speechSourceUnits(truth.text));assert.equal(score.passed,true);
 const output={mode:'recorded-response-offline-replay',recordedStatus:entry.status,recordedReport:path.resolve(file),recordedId:entry.id,paidRequests:0,replayCalls,formatRecovery:result.result.result.localFormatRecovery,score,result:result.result};
 fs.writeFileSync(path.join(path.dirname(file),'offline-replay.json'),JSON.stringify(output,null,2));console.log({paidRequests:0,replayCalls,formatRecovery:output.formatRecovery,scorePassed:score.passed,bodyPreserved:true});
}finally{globalThis.fetch=originalFetch;}
