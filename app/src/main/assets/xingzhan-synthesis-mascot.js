const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function mountMascot(options){
 const old=document.querySelector('#xingzhan-mascot');if(old)old.remove();
 const host=document.createElement('div');host.id='xingzhan-mascot';host.hidden=!options.enabled;
 options.minimized=!!options.minimized;
 options.dockSide=options.dockSide==='left'?'left':'right';
 host.dataset.minimized=String(options.minimized);host.dataset.side=options.dockSide;
 host.innerHTML=`<button type="button" class="xs-mascot-bubble" aria-label="打开星灯快捷控制" aria-expanded="false" aria-controls="xingzhan-mascot-panel" title="拖动星灯调整位置，点击打开快捷控制"><img alt="" draggable="false"></button>
 <section id="xingzhan-mascot-panel" class="xs-mascot-panel" role="dialog" aria-label="星灯快捷控制" popover="manual" hidden>
  <header><div><strong>星灯 · 快捷控制</strong><small>酒馆内悬浮入口</small></div><div class="xs-mascot-header-actions"><button type="button" data-xs-mascot-minimize aria-label="收起到屏幕侧边" title="收起到屏幕侧边">−</button><button type="button" data-xs-mascot-close aria-label="关闭快捷控制">×</button></div></header>
  <div class="xs-mascot-actions">
   <button type="button" data-xs-mascot-action="speech"><b>配音窗口</b><small>继续当前角色卡的配音</small></button>
   <button type="button" data-xs-mascot-action="latest"><b>配音最新回复</b><small>带入最近一条剧情消息</small></button>
   <button type="button" data-xs-mascot-action="image"><b>插图工作台</b><small>打开后手动选择生成内容</small></button>
   <button type="button" data-xs-mascot-action="chat"><b>回到最新聊天</b><small>滚动到当前对话末尾</small></button>
   <button type="button" data-xs-mascot-action="manage"><b>管理与更新</b><small>保存聊天后进入应用管理页</small></button>
  </div>
  <p data-xs-mascot-status role="status"></p>
  <button type="button" class="xs-mascot-hide" data-xs-mascot-hide>隐藏悬浮形象</button>
 </section>`;
 const bubble=host.querySelector('.xs-mascot-bubble'),panel=host.querySelector('.xs-mascot-panel'),status=host.querySelector('[data-xs-mascot-status]');
 if(options.minimized){bubble.setAttribute('aria-label','展开星灯快捷控制');bubble.title='拖动边签调整位置，点击展开星灯';}
 bubble.querySelector('img').src=new URL('./mascot.png',import.meta.url).href;
 document.body.append(host);

 function placeBubble(){
  const width=bubble.offsetWidth||68,height=bubble.offsetHeight||68;
  if(options.minimized){
   const availableY=Math.max(0,innerHeight-height-16);
   const top=Number.isFinite(options.dockY)?8+clamp(options.dockY,0,1)*availableY:innerHeight-height-148;
   host.style.left=(options.dockSide==='left'?0:Math.max(0,innerWidth-width))+'px';
   host.style.top=clamp(top,8,Math.max(8,innerHeight-height-8))+'px';
   return;
  }
  const availableX=Math.max(0,innerWidth-width-16),availableY=Math.max(0,innerHeight-height-16);
  const saved=options.position||{};
  const left=Number.isFinite(saved.x)?8+clamp(saved.x,0,1)*availableX:innerWidth-width-16;
  const top=Number.isFinite(saved.y)?8+clamp(saved.y,0,1)*availableY:innerHeight-height-148;
  host.style.left=clamp(left,8,Math.max(8,innerWidth-width-8))+'px';
  host.style.top=clamp(top,8,Math.max(8,innerHeight-height-8))+'px';
 }
 function persistPosition(){
  const width=bubble.offsetWidth||68,height=bubble.offsetHeight||68;
  const x=(parseFloat(host.style.left)-8)/Math.max(1,innerWidth-width-16);
  const y=(parseFloat(host.style.top)-8)/Math.max(1,innerHeight-height-16);
  options.position={x:clamp(x,0,1),y:clamp(y,0,1)};
  options.onPosition?.(options.position);
 }
 function persistDock(){
  const height=bubble.offsetHeight||60;
  options.dockSide=host.dataset.side==='left'?'left':'right';
  options.dockY=clamp((parseFloat(host.style.top)-8)/Math.max(1,innerHeight-height-16),0,1);
  options.onDock?.({minimized:options.minimized,side:options.dockSide,y:options.dockY});
 }
 function placePanel(){
  const rect=bubble.getBoundingClientRect(),width=panel.offsetWidth,height=panel.offsetHeight;
  panel.style.left=clamp(rect.right-width,8,Math.max(8,innerWidth-width-8))+'px';
  const below=rect.bottom+10,above=rect.top-height-10;
  panel.style.top=clamp(above>=8?above:below,8,Math.max(8,innerHeight-height-8))+'px';
 }
 const isPopoverOpen=()=>typeof panel.showPopover==='function'&&panel.matches(':popover-open');
 function close(){if(isPopoverOpen())panel.hidePopover();panel.hidden=true;bubble.setAttribute('aria-expanded','false');status.textContent='';}
 function open(){panel.hidden=false;if(typeof panel.showPopover==='function'&&!isPopoverOpen())panel.showPopover();bubble.setAttribute('aria-expanded','true');placePanel();panel.querySelector('[data-xs-mascot-close]').focus();}
 function toggle(){panel.hidden?open():close();}
 function setEnabled(enabled){host.hidden=!enabled;if(!enabled)close();else placeBubble();}
 function minimize(){
  const rect=bubble.getBoundingClientRect();close();
  options.minimized=true;options.dockSide=rect.left+rect.width/2<innerWidth/2?'left':'right';
  options.dockY=clamp((rect.top-8)/Math.max(1,innerHeight-60-16),0,1);
  host.dataset.minimized='true';host.dataset.side=options.dockSide;
  bubble.setAttribute('aria-label','展开星灯快捷控制');bubble.title='拖动边签调整位置，点击展开星灯';
  placeBubble();persistDock();
 }
 function restore(){
  options.minimized=false;host.dataset.minimized='false';
  bubble.setAttribute('aria-label','打开星灯快捷控制');bubble.title='拖动星灯调整位置，点击打开快捷控制';
  placeBubble();persistDock();open();
 }

 let drag=null,suppressClick=false;
 bubble.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:parseFloat(host.style.left)||0,top:parseFloat(host.style.top)||0,moved:false};
  bubble.setPointerCapture(event.pointerId);
 });
 bubble.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<6)return;
  drag.moved=true;close();
  if(options.minimized){host.dataset.side=event.clientX<innerWidth/2?'left':'right';host.style.left=(host.dataset.side==='left'?0:Math.max(0,innerWidth-bubble.offsetWidth))+'px';}
  else host.style.left=clamp(drag.left+dx,8,Math.max(8,innerWidth-bubble.offsetWidth-8))+'px';
  host.style.top=clamp(drag.top+dy,8,Math.max(8,innerHeight-bubble.offsetHeight-8))+'px';
 });
 bubble.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.id)return;if(drag.moved){options.minimized?persistDock():persistPosition();suppressClick=true;}drag=null;});
 bubble.addEventListener('pointercancel',()=>{if(drag?.moved){options.minimized?persistDock():persistPosition();}drag=null;});
 bubble.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}options.minimized?restore():toggle();});
 panel.querySelector('[data-xs-mascot-close]').addEventListener('click',close);
 panel.querySelector('[data-xs-mascot-minimize]').addEventListener('click',minimize);
 panel.querySelector('[data-xs-mascot-hide]').addEventListener('click',()=>{setEnabled(false);options.onHide?.();});
 panel.querySelectorAll('[data-xs-mascot-action]').forEach(button=>button.addEventListener('click',async()=>{
  const action=button.dataset.xsMascotAction,handler=options.actions?.[action];if(!handler)return;
  status.textContent=action==='manage'?'正在保存聊天并进入管理页…':'';
  if(action!=='manage')close();
  try{await handler();if(action==='manage')close();}
  catch(error){open();status.textContent='操作失败：'+(error?.message||String(error));}
 }));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)close();});
 document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!host.contains(event.target))close();});
 addEventListener('resize',()=>{if(!host.hidden)placeBubble();if(!panel.hidden)placePanel();});
 placeBubble();
 return {setEnabled};
}
