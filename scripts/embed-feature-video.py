import pathlib,base64
video=pathlib.Path('artifacts/features/synthetic-VP80.webm').read_bytes()
assert video[:4]==bytes.fromhex('1a45dfa3') and len(video)<100_000
encoded=base64.b64encode(video).decode()
handler="document.querySelector('#video').onclick=async()=>{try{const v=document.querySelector('#preview');v.srcObject=null;v.src='data:video/webm;base64,"+encoded+"';v.loop=true;await v.play();record('video',{playing:!v.paused,width:v.videoWidth,height:v.videoHeight})}catch(e){record('video',e.name)}};"
target=pathlib.Path('app/src/main/assets/android-probe.html');html=target.read_text(encoding='utf-8');start=html.index("document.querySelector('#video').onclick=");end=html.index("document.querySelector('#fullscreen').onclick=",start);target.write_text(html[:start]+handler+'\n'+html[end:],encoding='utf-8')
pathlib.Path('scripts/feature-video-live.js').write_text(handler+'\ntrue',encoding='utf-8')
