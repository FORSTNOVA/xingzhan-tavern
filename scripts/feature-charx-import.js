(async()=>{
 const file=document.querySelector('#single').files[0];if(file?.name!=='apk-feature-card.charx')throw Error('Expected own charx fixture');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const {token}=await(await fetch('/csrf-token')).json();const headers={'X-CSRF-Token':token};const form=new FormData();form.append('file_type','charx');form.append('avatar',file);
 const imported=await fetch('/api/characters/import',{method:'POST',headers,body:form});const data=await imported.json();const result={name:file.name,size:file.size,sha256:hash,importStatus:imported.status};
 if(!imported.ok)throw Error('Charx import failed '+imported.status);const avatar=data.file_name+'.png';if(!avatar.startsWith('APK File Selection Fixture'))throw Error('Unexpected fixture avatar');
 const removed=await fetch('/api/characters/delete',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({avatar_url:avatar,delete_chats:false})});result.deleteStatus=removed.status;return result;
})()
