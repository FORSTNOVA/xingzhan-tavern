import fs from 'fs';

function patchSystemJs() {
  const file = 'D:/codebuddythink/jiuguan/plugins/xingzhan-synthesis/system.js';
  const content = fs.readFileSync(file, 'utf8');
  const isCrlf = content.includes('\r\n');
  const lines = content.split(/\r?\n/);

  // Line containing the role select label
  const roleIdx = lines.findIndex(l => l.includes('data-system-role'));
  if (roleIdx >= 0) {
    lines[roleIdx] = lines[roleIdx].replace(
      '<label style="flex:1 1 200px">选择音色<select class="text_pole" data-system-role="${esc(profile.id)}"></select></label></div>',
      '<label style="flex:1 1 180px">选择音色<select class="text_pole" data-system-role="${esc(profile.id)}"></select></label><button type="button" class="menu_button" data-system-preview="${esc(profile.id)}" style="flex:0 0 auto;margin-top:auto" title="试听该音色">▶ 试听</button></div>'
    );
  }

  // Find voiceSelect.onchange
  const onchangeIdx = lines.findIndex((l, i) => i > roleIdx && l.includes('voiceSelect.onchange'));
  if (onchangeIdx >= 0) {
    const previewCode = [
      '   const previewBtn = row.querySelector("[data-system-preview]");',
      '   let previewAudio = null;',
      '   previewBtn.onclick = async () => {',
      '     if (previewAudio && !previewAudio.paused) { previewAudio.pause(); previewBtn.textContent = "▶ 试听"; return; }',
      '     const targetVoice = voiceSelect.value;',
      '     if (!targetVoice) return;',
      '     previewBtn.disabled = true; previewBtn.textContent = "⏳ 生成中…";',
      '     try {',
      '       const cfg = config();',
      '       const sample = "你好，我是" + (profile.name || "发音人") + "，这是我的试听声音。";',
      '       const res = await nativeTts("synthesize", { engine: cfg.engine, voice: targetVoice, rate: cfg.rate || 1, pitch: cfg.pitch || 1, text: sample, scopeId: scope.id });',
      '       if (!previewAudio) previewAudio = new Audio();',
      '       previewAudio.src = "/api/android/media/system-preview/" + res.key;',
      '       previewBtn.textContent = "⏹ 停止"; previewBtn.disabled = false;',
      '       previewAudio.onended = () => { previewBtn.textContent = "▶ 试听"; };',
      '       previewAudio.onerror = () => { previewBtn.textContent = "▶ 试听"; query("status").textContent = "试听音频加载失败"; };',
      '       await previewAudio.play();',
      '     } catch (err) {',
      '       previewBtn.textContent = "▶ 试听"; previewBtn.disabled = false;',
      '       query("status").textContent = "试听失败：" + err.message;',
      '     }',
      '   };'
    ];
    lines.splice(onchangeIdx + 4, 0, ...previewCode);
  }

  fs.writeFileSync(file, lines.join(isCrlf ? '\r\n' : '\n'), 'utf8');
  console.log('system.js patched successfully!');
}

function patchIndexJs() {
  const file = 'D:/codebuddythink/jiuguan/plugins/xingzhan-synthesis/index.js';
  const content = fs.readFileSync(file, 'utf8');
  const isCrlf = content.includes('\r\n');
  const lines = content.split(/\r?\n/);

  const roleIdx = lines.findIndex(l => l.includes('data-profile-role'));
  if (roleIdx >= 0) {
    lines[roleIdx] = lines[roleIdx].replace(
      '<label style="flex:1 1 200px">选择音色<select class="text_pole" data-profile-role="${escapeHtml(profile.id)}"></select></label></div>',
      '<label style="flex:1 1 180px">选择音色<select class="text_pole" data-profile-role="${escapeHtml(profile.id)}"></select></label><button type="button" class="menu_button" data-api-preview="${escapeHtml(profile.id)}" style="flex:0 0 auto;margin-top:auto" title="试听该音色">▶ 试听</button></div>'
    );
  }

  const onchangeIdx = lines.findIndex((l, i) => i > roleIdx && l.includes('voiceSelect.addEventListener(\'change\''));
  if (onchangeIdx >= 0) {
    const previewCode = [
      '   const previewBtn = row.querySelector("[data-api-preview]");',
      '   let previewAudio = null;',
      '   previewBtn.onclick = async () => {',
      '     if (previewAudio && !previewAudio.paused) { previewAudio.pause(); previewBtn.textContent = "▶ 试听"; return; }',
      '     const targetVoice = voiceSelect.value;',
      '     if (!targetVoice) return;',
      '     previewBtn.disabled = true; previewBtn.textContent = "⏳ 生成中…";',
      '     try {',
      '       const sample = "你好，我是" + (profile.name || "发音人") + "，这是我的试听声音。";',
      '       const res = await mediaRequest("generate-tts", { input: sample, voice: targetVoice });',
      '       const blob = await res.blob();',
      '       if (!previewAudio) previewAudio = new Audio();',
      '       previewAudio.src = URL.createObjectURL(blob);',
      '       previewBtn.textContent = "⏹ 停止"; previewBtn.disabled = false;',
      '       previewAudio.onended = () => { previewBtn.textContent = "▶ 试听"; };',
      '       previewAudio.onerror = () => { previewBtn.textContent = "▶ 试听"; };',
      '       await previewAudio.play();',
      '     } catch (err) {',
      '       previewBtn.textContent = "▶ 试听"; previewBtn.disabled = false;',
      '       alert("试听失败：" + err.message);',
      '     }',
      '   };'
    ];
    lines.splice(onchangeIdx + 4, 0, ...previewCode);
  }

  fs.writeFileSync(file, lines.join(isCrlf ? '\r\n' : '\n'), 'utf8');
  console.log('index.js patched successfully!');
}

patchSystemJs();
patchIndexJs();
