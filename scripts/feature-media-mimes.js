({mimes:['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm','video/mp4;codecs=avc1','video/mp4'].map(m=>[m,MediaRecorder.isTypeSupported(m)]),fullscreen:!!document.fullscreenElement})
