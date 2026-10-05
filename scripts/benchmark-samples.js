(async()=>{
 const results=[];
 for(let i=0;i<3;i++){
  await window.__TAVERNMARK.selfCheck();
  results.push({checks:window.__TAVERNMARK.checks(),log:window.__TAVERNMARK.log().slice(-3)});
  await new Promise(r=>setTimeout(r,1000));
 }
 return {samples:results,buttons:[...document.querySelectorAll('button')].map(b=>({text:b.innerText,act:b.dataset.act,mode:b.dataset.mode}))};
})()
