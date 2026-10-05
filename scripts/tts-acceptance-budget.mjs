import fs from 'node:fs';
export function reserve(file,kind,count,label){
 const state=JSON.parse(fs.readFileSync(file));if(!Number.isInteger(count)||count<1||!state[kind]||state[kind].used+count>state[kind].authorized)throw Error('本轮 '+kind+' 调用上限不足');
 const id=crypto.randomUUID();state[kind].used+=count;state.operations.push({id,kind,count,label,state:'reserved',at:new Date().toISOString()});fs.writeFileSync(file,JSON.stringify(state,null,2));return id;
}
export function settle(file,id,actual){const state=JSON.parse(fs.readFileSync(file)),item=state.operations.find(x=>x.id===id);if(!item||item.state!=='reserved'||!Number.isInteger(actual)||actual<0||actual>item.count)throw Error('调用计数无法核对');state[item.kind].used-=item.count-actual;item.actual=actual;item.state='settled';fs.writeFileSync(file,JSON.stringify(state,null,2));}
