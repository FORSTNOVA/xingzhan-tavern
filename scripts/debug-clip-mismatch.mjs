import { connect } from './webview-cdp.mjs';
import { execFileSync } from 'node:child_process';

const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const c = await connect();
try {
  const out = await c.evaluate(`(async () => {
    const media = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
    const list = await (await media.mediaRequest('sessions?scope=manual')).json();
    const rec = await media.loadSpeechSession(list.sessions[0].id, {id:'manual'});
    return { provider: rec.provider, system: rec.system, voices: rec.voices,
      segs: rec.result.segments.map(s => ({type:s.type, speaker:s.speakerId, text:s.text, system:s.system})) };
  })()`);
  console.log('SERVER SESSION:', JSON.stringify(out, null, 2));
} finally { c.close(); }

const dir = 'files/tavern/.android-system-tts';
const files = execFileSync(adb, ['-s','ca168055','shell',`run-as cn.jiuguan.probe sh -c 'ls -t ${dir}/*.json | head -3'`], {encoding:'utf8'}).trim().split(/\r?\n/);
for (const f of files) console.log('NATIVE META', f, execFileSync(adb, ['-s','ca168055','shell',`run-as cn.jiuguan.probe cat ${f}`], {encoding:'utf8'}));
