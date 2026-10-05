import assert from 'node:assert/strict';
import {loadEvaluationRuntime} from './tts-evaluation-runtime.mjs';
const {backend}=await loadEvaluationRuntime();
const profiles=[{id:'lin',name:'小林',aliases:['林医生']},{id:'mei',name:'小梅',aliases:[]}];
const classify=(text,id='narrator',speakers=profiles)=>{const units=backend.speechSourceUnits(text);return backend.annotateClassification({speakers:structuredClone(speakers),segments:units.map(u=>({unitIds:[u.id],text:u.text,type:u.quoted?'dialogue':'narration',speakerId:u.quoted?id:'narrator',speakerConfidence:1,typeConfidence:1,evidenceUnitIds:[u.id]}))},units);};
for(const text of ['小林说：“你好。”','“你好。”小林低声说道。','林医生说：“你好。”']){
 const dialogue=classify(text).segments.find(x=>x.type==='dialogue');assert.equal(dialogue.speakerId,'lin');assert.ok(dialogue.identityCorrection);assert.ok(dialogue.reviewReasons.length);
}
const conflict=classify('小林说：“你好。”','mei').segments.find(x=>x.type==='dialogue');assert.equal(conflict.speakerId,'mei');assert.ok(conflict.reviewReasons.some(x=>x.includes('不一致')));
const sequential=classify('小林说：“你好。”小梅说：“再见。”','__unresolved__').segments.filter(x=>x.type==='dialogue');assert.deepEqual(sequential.map(x=>x.speakerId),['lin','mei']);
for(const text of ['他看着小林。“你好。”','他对小林说：“你好。”','“你好。”他低声说道。','小林想起老师常说的“别急”。'])assert.equal(classify(text).segments.find(x=>x.type==='dialogue').speakerId,'__unresolved__',text);
const duplicate=classify('小林说：“你好。”','narrator',[...profiles,{id:'another-lin',name:'小林'}]);assert.equal(duplicate.segments.find(x=>x.type==='dialogue').speakerId,'__unresolved__');
const isolated=classify('小林说：“你好。”','narrator',[]);assert.equal(isolated.segments.find(x=>x.type==='dialogue').speakerId,'__unresolved__');assert.ok(isolated.speakers.some(x=>x.id==='__unresolved__'));
const long='小林说：“'+('这是连续对白。'.repeat(70))+'”';
const parts=backend.planSpeechAnalysisParts(long);
const continuation=parts[1],continued=backend.annotateClassification({speakers:structuredClone(profiles),segments:continuation.units.map(u=>({unitIds:[u.id],text:u.text,type:'dialogue',speakerId:'narrator',typeConfidence:1,speakerConfidence:1}))},continuation.units);
assert.equal(continued.segments[0].speakerId,'lin');assert.ok(continued.segments[0].identityCorrection);
const separate=backend.planSpeechAnalysisParts('小林说：“你好。”“独立引用。”').flatMap(p=>p.units);assert.ok(!separate.at(-1).attributionText,'独立引用不能继承已闭合台词的发言引导');
console.log('Direct names/aliases, conflicting identity, consecutive speakers, pronouns, quoted references and scope isolation passed; real calls: 0.');
