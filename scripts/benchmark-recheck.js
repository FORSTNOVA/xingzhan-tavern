(async()=>{
 const host=parent.document.querySelector('#chat');if(host)host.scrollTop=0;
 await new Promise(r=>setTimeout(r,1500));
 await window.__TAVERNMARK.selfCheck();
 return {text:document.body.innerText,api:Object.keys(window.__TAVERNMARK),raw:window.__TM_LAST__||null};
})()
