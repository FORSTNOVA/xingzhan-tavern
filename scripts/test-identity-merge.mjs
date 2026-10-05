import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('plugins/xingzhan-synthesis/media.js','utf8'),helpers=source.slice(source.indexOf('const REVIEW_FIELDS='),source.indexOf('export function mountSpeechReviewTools'));
const api=vm.runInNewContext(helpers.replaceAll('export ','')+';({planSpeechIdentityMerge,mergeSpeechIdentities,undoSpeechReview})',{structuredClone,Date});
const fresh=()=>({speakers:[{id:'a',name:'林医生',aliases:[],gender:'male'},{id:'b',name:'小林',aliases:['林'],gender:'male'}],segments:[{type:'dialogue',speakerId:'a',text:'你好。',system:{voice:'source',pitch:.8,rate:1},identityEvidenceConflict:true},{type:'dialogue',speakerId:'b',text:'再见。',system:{voice:'target',pitch:1,rate:1}}]});
let r=fresh();assert.equal(api.planSpeechIdentityMerge(r,'a','b').indices.length,1);api.mergeSpeechIdentities(r,'a','b');assert.equal(r.segments[0].speakerId,'b');assert.equal(r.segments[0].system.voice,'target');assert.equal(r.segments[0].system.pitch,.8);assert.equal(r.speakers[0].mergedInto,'b');assert.ok(r.speakers[1].aliases.includes('林医生'));assert.equal(r.segments[0].identityEvidenceConflict,false);assert.equal(r.segments.map(x=>x.text).join(''),'你好。再见。');assert.equal(api.undoSpeechReview(r),true);assert.equal(r.segments[0].speakerId,'a');assert.equal(r.segments[0].system.voice,'source');assert.equal(r.speakers[0].mergedInto,undefined);
for(const id of ['a','b']){r=fresh();r.segments.find(x=>x.speakerId===id).manualLocked=true;const before=JSON.stringify(r);assert.throws(()=>api.mergeSpeechIdentities(r,'a','b'),/锁定/);assert.equal(JSON.stringify(r),before);}
r=fresh();assert.throws(()=>api.mergeSpeechIdentities(r,'a','a'));assert.throws(()=>api.mergeSpeechIdentities(r,'a','missing'));r.speakers[1].aliases=Array.from({length:10},(_,i)=>'别名'+i);assert.throws(()=>api.mergeSpeechIdentities(r,'a','b'),/别名/);assert.equal(r.reviewHistory,undefined);
r=fresh();r.speakers[1].gender='female';assert.equal(api.planSpeechIdentityMerge(r,'a','b').genderConflict,true);
console.log('Merge, undo, target voice, original text, both sides locked, alias overflow and gender conflict tests passed; paid calls: 0.');
