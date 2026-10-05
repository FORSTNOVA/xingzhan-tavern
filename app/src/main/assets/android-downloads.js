(()=>{
 if(location.origin!=='http://127.0.0.1:8787'||window.__apkDownloads)return;
 async function exportUrl(url,filename='download.bin'){
  const response=await fetch(url);if(!response.ok)throw new Error('无法读取待保存文件');
  const blob=await response.blob();if(blob.size>128*1024*1024)throw new Error('文件超过 128 MB 保存上限');
  const {token}=await(await fetch('/csrf-token')).json();
  const saved=await fetch('/api/android/download',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':token,'X-Apk-Filename':encodeURIComponent(filename),'X-Apk-Mime':blob.type.split(';')[0]||'application/octet-stream'},body:blob});
  if(!saved.ok)throw new Error('文件保存准备失败：'+saved.status);
  const data=await saved.json();const anchor=document.createElement('a');anchor.href=data.url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();return data;
 }
 window.__apkDownloads={exportUrl};
 function install(document){document.addEventListener('click',event=>{
  const anchor=event.target.closest?.('a[download]');if(!anchor||!/^blob:|^data:/.test(anchor.href))return;
  event.preventDefault();event.stopImmediatePropagation();exportUrl(anchor.href,anchor.download).catch(error=>{if(window.toastr)window.toastr.error(error.message);else alert(error.message);console.error('APK export failed:',error.message);});
 },true);}
 install(document);
 const frames=new WeakSet();function frameLoaded(frame){try{const doc=frame.contentDocument;if(doc&&!frames.has(doc)){frames.add(doc);install(doc);}}catch{}}
 document.querySelectorAll('iframe').forEach(frameLoaded);
 document.addEventListener('load',event=>{if(event.target.tagName==='IFRAME')frameLoaded(event.target);},true);
})()
