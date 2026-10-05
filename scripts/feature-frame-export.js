(async()=>{
 const frame=document.createElement('iframe');frame.id='apk-frame-export-test';frame.srcdoc='<p>同源角色卡文件导出验证</p>';document.body.appendChild(frame);await new Promise(resolve=>frame.onload=resolve);
 const win=frame.contentWindow;const doc=frame.contentDocument;const anchor=doc.createElement('a');anchor.download='apk-frame-export.json';anchor.href=win.URL.createObjectURL(new win.Blob([JSON.stringify({sameOriginFrameExport:true})],{type:'application/json'}));doc.body.appendChild(anchor);anchor.click();return {frameCreated:true};
})()
