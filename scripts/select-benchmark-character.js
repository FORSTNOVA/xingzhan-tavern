(async()=>{
 const main=await import('/script.js');
 const index=main.characters.findIndex(character=>character.avatar==='TavernMark 酒馆排位赛.png');
 if(index<0)throw new Error('Benchmark character missing');
 await main.selectCharacterById(index,{switchMenu:false});
 document.querySelector('#chat').scrollTop=0;
 return {selected:true,profile:window.__apkMobilePerformance.status()};
})()
