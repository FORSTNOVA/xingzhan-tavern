(() => {
 const candidates=[...document.querySelectorAll('[data-file_name], [data-chatfile], .recentChat, .recent-chat, .recent-chat-entry, .recent_chat')];
 const target=candidates.find(e=>e.innerText.includes('TavernMark'));
 if(target){target.click();return {clicked:true,tag:target.tagName,class:target.className};}
 return {clicked:false,matches:[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.textContent.includes('TavernMark')).slice(0,8).map(e=>({tag:e.tagName,class:e.className,parent:e.parentElement?.outerHTML.slice(0,2500)}))};
})()
