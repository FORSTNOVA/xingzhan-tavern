(async()=>{
 const results=[];
 for(const type of ['srcdoc','blob']){
  const iframe=document.createElement('iframe');iframe.style.cssText='width:100px;height:50px';
  const html='<html><body><div id="root">loaded</div><script>window.probeExecuted=true;<'+ '/script></body></html>';
  let url,loaded=false;iframe.onload=()=>loaded=true;
  if(type==='blob'){url=URL.createObjectURL(new Blob([html],{type:'text/html'}));iframe.src=url;}else iframe.srcdoc=html;
  document.body.append(iframe);await new Promise(r=>setTimeout(r,1500));
  let state;try{state={url:iframe.contentWindow.location.href,text:iframe.contentDocument?.body?.innerText,script:iframe.contentWindow.probeExecuted===true};}catch(e){state={error:String(e)}}
  results.push({type,loaded,...state});iframe.remove();if(url)URL.revokeObjectURL(url);
 }
 return results;
})()
