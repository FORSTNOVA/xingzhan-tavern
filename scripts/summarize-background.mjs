import fs from 'node:fs';
const labels=['baseline','wakelock','wakelock-exempt'];
const rows=labels.map(label=>{
 const data=JSON.parse(fs.readFileSync(`artifacts/background-${label}.json`,'utf8'));
 return {label,startedAt:data.startedAt,completedAt:data.completedAt || null,pids:[...new Set(data.samples.map(s=>s.pid))],samples:data.samples.map(s=>({seconds:s.seconds,phase:s.phase,count:s.task?.count,readError:s.taskError || null,streamReceived:s.streamReceived,screen:s.power.find(l=>l.startsWith('mWakefulness=')),wakeLock:s.power.find(l=>l.includes("PARTIAL_WAKE_LOCK")&&l.includes('TavernProbe:BackgroundComparison')) || null})),sse:{sent:data.sse.sent,received:data.sse.received,expected:90,done:data.sse.done,error:data.sse.error || null,maxDeliveryGapSeconds:Math.max(0,...data.sse.times.slice(1).map((t,i)=>t.seconds-data.sse.times[i].seconds)),screenOffDelivered:data.sse.times.filter(t=>t.phase==='screen-off').length},lastTask:data.samples.at(-1)?.task};
});
fs.writeFileSync('artifacts/background-summary.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows,null,2));
