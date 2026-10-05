import fs from 'node:fs';
import {loadEvaluationRuntime} from './tts-evaluation-runtime.mjs';
import {validateEvaluationDataset} from './tts-evaluation-core.mjs';
const existing=JSON.parse(fs.readFileSync('scripts/fixtures/tts-expanded-cases.json','utf8'));
const n=text=>({text,type:'narration',speaker:'narrator'}),d=(text,speaker)=>({text,type:'dialogue',speaker});
const cases=[structuredClone(existing.cases.find(c=>c.id==='expanded-long-turns'))];
function add(id,name,expectedSpans,extra={}){cases.push({id,name,split:'development',text:expectedSpans.map(x=>x.text).join(''),expectedSpans,...extra});}
add('natural-three-people','自然剧情三人交替',[n('雨水顺着窗沿滴落。陈舟把地图推到桌子中央，说：'),d('“我们从北门进去。”','陈舟'),n('林溪摇了摇头。'),d('“那边有守卫。”','林溪'),n('林溪补充道。赵宁走到窗前，问：'),d('“南门呢？”','赵宁'),n('陈舟收起地图，回答：'),d('“天亮后再决定。”','陈舟')]);
add('natural-alias-reference','世界书别名与主配角',[n('沈医生合上病历，说：'),d('“明早再做一次检查。”','沈岚'),n('阿澈站起身，问：'),d('“我能陪她一起去吗？”','许澈'),n('沈医生点点头。')],{expectedSpeakerAliases:{沈岚:['沈医生'],许澈:['阿澈']},worldReferences:[{world:'人物资料',uid:'doctor',title:'沈岚',keys:['沈医生'],content:'沈岚是女性医生，别人称她沈医生。'},{world:'人物资料',uid:'partner',title:'许澈',keys:['阿澈'],content:'许澈是男性，阿澈是他的昵称。'}]});
add('natural-unquoted','自然无引号双人物',[n('仓库里只剩一盏灯。陈舟说：'),d('先别开门。','陈舟'),n('林溪回答：'),d('我听见外面有人。','林溪'),n('陈舟问：'),d('能看清是谁吗？','陈舟'),n('林溪低声说道：'),d('是赵宁，他回来了。','林溪')]);
add('natural-reference-not-speech','书名、回忆与当前台词',[n('林溪看见书名“远山”，想起老师常说的“不要急”。陈舟问：'),d('“你在看什么？”','陈舟'),n('林溪把书放回架上，说：'),d('“一本旧书。”','林溪')]);
add('natural-user-not-character','聊天作者不等于剧情说话者',[n('陆遥倚着栏杆，说：'),d('“我会等你回来。”','陆遥'),n('周晴握紧车票，回答：'),d('“别站在雨里。”','周晴')],{speakers:[{id:'user',name:'读者'},{id:'assistant',name:'故事'}]});
add('natural-unresolved','身份不足时保留未知',[n('两个人都藏在屏风后，谁也看不清。'),d('“别点灯。”','__unresolved__'),n('黑暗里传来一句低语。门外的赵宁问：'),d('“里面是谁？”','赵宁')]);
add('natural-continuation','跨句动作与后置人物',[n('陈舟把杯子递给林溪。'),d('“谢谢。”','林溪'),n('林溪轻声说道。赵宁推开门，喊道：'),d('“车到了！”','赵宁'),n('陈舟拿起外套，问：'),d('“行李都带上了吗？”','陈舟'),n('林溪回答：'),d('都在门口。','林溪')]);
const dataset={schemaVersion:2,status:'自然剧情开发样本与既有长篇复测；原预留集未使用',pilotIds:cases.map(c=>c.id),cases};validateEvaluationDataset(dataset);
const {backend}=await loadEvaluationRuntime(),plan=cases.map(c=>({id:c.id,characters:c.text.length,units:backend.speechSourceUnits(c.text).length,batches:backend.planSpeechAnalysisParts(c.text).length,maxCalls:c.maxCalls||1}));
if(plan.some(p=>p.batches>p.maxCalls))throw Error('样本预计批数超出调用预算');
fs.writeFileSync('scripts/fixtures/tts-natural-cases.json',JSON.stringify(dataset,null,2));
console.log(JSON.stringify({plan,maxCalls:plan.reduce((n,p)=>n+p.maxCalls,0),realCalls:0},null,2));
