import assert from 'node:assert/strict';
import {connect} from './webview-cdp.mjs';
const c=await connect();try{
 const result=await c.evaluate(`(async()=>{const m=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');const r={speakers:[{id:'lin',name:'小林'}],segments:[{text:'测试台词',type:'dialogue',speakerId:'lin',identityEvidenceConflict:true,reviewReasons:['发言依据与人物归属不一致'],speakerEvidenceCandidates:[{id:'other',name:'另一人'}]}]};const before=m.unresolvedSpeechSegments(r).length;m.applySpeechBatch(r,[0],'confirm');const after=m.unresolvedSpeechSegments(r).length;m.undoSpeechReview(r);return {before,after,undo:m.unresolvedSpeechSegments(r).length,metadataPreserved:r.segments[0].speakerEvidenceCandidates[0].id==='other',realCalls:0};})()`);
 assert.deepEqual(result,{before:1,after:0,undo:1,metadataPreserved:true,realCalls:0});console.log(JSON.stringify(result));
}finally{c.close();}
