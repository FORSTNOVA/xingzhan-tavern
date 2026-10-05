import assert from 'node:assert/strict';
import {loadEvaluationRuntime} from './tts-evaluation-runtime.mjs';
const {backend}=await loadEvaluationRuntime();
for(const text of ['方哲说：请把门关上。','小林低声说道:我已经准备好了。','门卫喊道：请出示证件！']){
 const units=backend.speechSourceUnits(text);assert.equal(units.length,2,text);assert.match(units[0].text,/[：:]$/);assert.equal(units.map(x=>x.text).join(''),text);
}
for(const text of ['时间是12:30。','比例为1:2。','清单：苹果和梨。','“小林说：快走！”'])assert.equal(backend.speechSourceUnits(text).length,1,text);
const text='小林说：“'+('这是长篇连续对白。😀'.repeat(1600))+'”她放下信件。\n门卫说：现在可以进去了。';
const units=backend.speechSourceUnits(text),parts=backend.planSpeechAnalysisParts(text);
assert.equal(parts.map(x=>x.text).join(''),text);
assert.ok(parts.length>1);assert.ok(parts.every(x=>x.units.length<=60&&x.text.length<=6000));
const flat=parts.flatMap(x=>x.units);assert.deepEqual(flat.map(x=>({text:x.text,quoted:x.quoted})),units.map(x=>({text:x.text,quoted:x.quoted})));
assert.ok(parts[1].units[0].quoted,'跨批继续引用的台词必须保留 quoted 状态');
assert.ok(parts.every(x=>x.units.every((u,id)=>u.id===id)));
const quote='“'+('连续台词😀'.repeat(200))+'”',quoteUnits=backend.speechSourceUnits(quote),cut=501;
const first=backend.sliceSpeechUnits(quoteUnits,0,cut),second=backend.sliceSpeechUnits(quoteUnits,cut,quote.length);
assert.equal([...first,...second].map(x=>x.text).join(''),quote);assert.ok(second[0].quoted);
const dense=backend.planSpeechAnalysisParts('短句。'.repeat(130));assert.deepEqual(dense.map(x=>x.units.length),[60,60,10]);
const expanded=JSON.parse((await import('node:fs')).readFileSync('scripts/fixtures/tts-expanded-cases.json','utf8')).cases.at(-1);
const expandedParts=backend.planSpeechAnalysisParts(expanded.text);assert.equal(expandedParts.length,3);
assert.ok(expandedParts.every(p=>!p.units[0].quoted),'实际失败长篇的发言引导与台词不能跨批拆开');
assert.ok(expandedParts.every(p=>!/[：:]\s*$/u.test(p.units.at(-1).text)));
console.log('Unquoted attribution, time/list negatives, long quote continuity and dense batch planning passed; real calls: 0.');
