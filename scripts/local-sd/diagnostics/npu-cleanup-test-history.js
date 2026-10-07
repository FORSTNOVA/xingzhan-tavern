(async()=>{
 const {mediaRequest}=await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
 const ids=['d0bb06fa-01a5-49e4-8d2a-0eca59d59f86','e488ff69-d793-43a7-9f2e-11083d5a98b2','dfccaded-31f0-43d8-be5b-a3e12098d88e'];
 const removed=[];
 for(const id of ids){await mediaRequest('image-history/delete',{id,scopeId:'manual'});removed.push(id);}
 return {removed};
})()
