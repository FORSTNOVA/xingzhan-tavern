import fs from 'node:fs';
import {loadEvaluationRuntime} from './tts-evaluation-runtime.mjs';
import {scoreClassificationCase,summarizeClassificationScores} from './tts-evaluation-core.mjs';
const dir='artifacts/tts-evaluation/live-2026-10-04T09-12-26-409Z';
const report=JSON.parse(fs.readFileSync(dir+'/report.json','utf8')),fixture=JSON.parse(fs.readFileSync('scripts/fixtures/tts-expanded-cases.json','utf8')).cases.at(-1),{backend}=await loadEvaluationRuntime();
let offset=0;const batches=[];
for(const trace of report.records.at(-1).diagnostics){
 const input=JSON.parse(trace.request.body.messages[1].content),raw=JSON.parse(JSON.parse(trace.response.body).choices[0].message.content),coverage=backend.inspectSpeechUnitCoverage(raw.segments,input.sourceUnits);
 const spans=[];let cursor=0;for(const span of fixture.expectedSpans){const a=Math.max(offset,cursor),b=Math.min(offset+input.selectedText.length,cursor+span.text.length);if(a<b)spans.push({...span,text:span.text.slice(a-cursor,b-cursor)});cursor+=span.text.length;}
 const reference={...fixture,id:fixture.id+'-batch-'+(batches.length+1),text:input.selectedText,expectedSpans:spans};
 // Grade the saved model labels without applying newer speaker corrections.
 const resolved=backend.resolveSpeechUnits(raw.segments,input.sourceUnits),score=scoreClassificationCase(reference,resolved?{...raw,segments:resolved}:null,input.sourceUnits);
 batches.push({characters:input.selectedText.length,unitCount:input.sourceUnits.length,coverage,score,usage:trace.response.usage});offset+=input.selectedText.length;
}
if(offset!==fixture.text.length)throw Error('诊断正文不是完整长篇批次');
const summary={realCalls:3,wholeLongAccepted:false,partialOnly:true,metrics:summarizeClassificationScores(batches.map(x=>x.score)),batches};
fs.writeFileSync(dir+'/long-partial-score.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify({metrics:summary.metrics,batchCoverage:batches.map(x=>({units:x.unitCount,valid:x.coverage.valid,missing:x.coverage.missing}))},null,2));
