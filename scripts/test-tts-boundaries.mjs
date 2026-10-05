import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadEvaluationRuntime} from './tts-evaluation-runtime.mjs';
import {scoreClassificationCase,summarizeClassificationScores} from './tts-evaluation-core.mjs';
const {backend}=await loadEvaluationRuntime();
const annotate=(text,type='dialogue')=>{const units=backend.speechSourceUnits(text);return backend.annotateClassification({speakers:[{id:'actor',name:'人物'}],segments:units.map(u=>({unitIds:[u.id],text:u.text,type,speakerId:'actor',typeConfidence:1,speakerConfidence:1,evidenceUnitIds:[u.id]}))},units);};
for(const text of ['甲说：“走。”','“走。”小林低声说道。','“走。”他回头喊道。','"Stay here," Alice said.']){
 const result=annotate(text);assert.equal(result.segments.filter(s=>s.boundaryCorrection).length,1,text);
 assert.equal(result.segments.find(s=>s.boundaryCorrection).speakerId,'narrator');
 assert.ok(result.segments.find(s=>s.boundaryCorrection).reviewReasons.length);
 assert.equal(result.segments.map(s=>s.text).join(''),text);
}
for(const text of ['甲说：请把门关上。','“他说：走。”','“小林低声说道。”','“我听见他喊道，便跑了。”','“走。”他说不该这样回答。'])assert.ok(annotate(text).segments.every(s=>!s.boundaryCorrection),text);
assert.ok(annotate('“不是书名，是台词。”','narration').segments[0].reviewReasons.length);
assert.ok(annotate('轰隆！铁门重重落下。','sfx').segments[1].reviewReasons.some(s=>s.includes('可能漏读')));
const units=backend.speechSourceUnits('第一句。第二句。');
for(const ids of [[0,1,2],[0,0],[1,0],[0],['0',1]])assert.equal(backend.inspectSpeechUnitCoverage([{unitIds:ids}],units).valid,false);
assert.equal(backend.resolveSpeechUnits([{unitIds:[0,1,2]}],units),null);
assert.ok(!backend.speechCoverageError(backend.inspectSpeechUnitCoverage([{unitIds:[0,1,2]}],units)).includes('应为 2，收到 2'));
const baseline=JSON.parse(fs.readFileSync('artifacts/tts-evaluation/live-2026-10-04T08-09-49-790Z/report.json','utf8'));
const fixtures=JSON.parse(fs.readFileSync('scripts/fixtures/tts-classification-cases.json','utf8'));
const scores=baseline.records.filter(r=>r.result).map(record=>{
 const fixture=fixtures.cases.find(c=>c.id===record.id),units=backend.speechSourceUnits(fixture.text),result=structuredClone(record.result);
 backend.annotateClassification(result,units,result.worldReferences||[]);
 return scoreClassificationCase(fixture,result,units);
});
const metrics=summarizeClassificationScores(scores);
assert.equal(metrics.typeUnits.correct,18);assert.equal(metrics.typeUnits.total,19);
assert.equal(metrics.errorFlagRecall.correct,1);assert.equal(metrics.errorFlagRecall.total,1);
const output={mode:'saved-response-replay',liveCalls:0,note:'回放既有输出，不是新模型准确率。2 条越界回复仍拒绝；5 个明确叙述纠正，剩余背景音错误已提示。',metrics,scores};
fs.writeFileSync('artifacts/tts-evaluation/boundary-replay.json',JSON.stringify(output,null,2));
console.log('Boundary safety, coverage rejection and saved-response replay passed; real model calls: 0.');
