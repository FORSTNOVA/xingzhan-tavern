import fs from 'node:fs';
import {validateEvaluationDataset} from './tts-evaluation-core.mjs';
import {loadEvaluationRuntime} from './tts-evaluation-runtime.mjs';
const original=JSON.parse(fs.readFileSync('scripts/fixtures/tts-classification-cases.json','utf8'));
const cases=['p0-02','p3-01'].map(id=>structuredClone(original.cases.find(c=>c.id===id)));
const expectedSpans=[{text:'小林说：',type:'narration',speaker:'narrator'},{text:'先把门打开。',type:'dialogue',speaker:'小林'},{text:'小梅回答：',type:'narration',speaker:'narrator'},{text:'我来拿钥匙。',type:'dialogue',speaker:'小梅'}];
cases.push({id:'expanded-unquoted',name:'无引号双人物交替',split:'development',text:expectedSpans.map(x=>x.text).join(''),expectedSpans});
const spans=[];
for(let i=0;i<34;i++){const name=i%2?'小梅':'小林';spans.push({text:name+'说：',type:'narration',speaker:'narrator'},{text:'“这是第'+(i+1)+'次交接，'+('请核对编号与物品清单并保持原定交接顺序'.repeat(18))+'。”',type:'dialogue',speaker:name});}
spans.push({text:'小梅回答：',type:'narration',speaker:'narrator'},{text:'已经核对完毕。',type:'dialogue',speaker:'小梅'});
cases.push({id:'expanded-long-turns',name:'超 12000 字符跨批多人交替与结尾无引号对白',split:'development',maxCalls:3,text:spans.map(x=>x.text).join(''),expectedSpans:spans});
const dataset={schemaVersion:2,status:'新增开发样本；未触碰原预留验证集',pilotIds:cases.map(c=>c.id),cases};
validateEvaluationDataset(dataset);const {backend}=await loadEvaluationRuntime();
const plan=cases.map(c=>({id:c.id,characters:c.text.length,units:backend.speechSourceUnits(c.text).length,batches:backend.planSpeechAnalysisParts(c.text).length,maxCalls:c.maxCalls||1}));
if(plan.at(-1).batches!==3||plan.at(-1).characters<=12000)throw Error('长篇试点必须超过 12000 字符且保持 3 批预算');
fs.writeFileSync('scripts/fixtures/tts-expanded-cases.json',JSON.stringify(dataset,null,2));
console.log(JSON.stringify({plan,totalCallLimit:plan.reduce((n,c)=>n+c.maxCalls,0),realCalls:0},null,2));
