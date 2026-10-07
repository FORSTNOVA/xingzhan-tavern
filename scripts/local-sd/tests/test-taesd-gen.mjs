import {execFileSync} from 'node:child_process';
import {connect} from '../../webview-cdp.mjs';

const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const deviceId = 'ca168055';
const pid = execFileSync(adb, ['-s', deviceId, 'shell', 'pidof', 'cn.jiuguan.probe']).toString().trim();
execFileSync(adb, ['-s', deviceId, 'forward', 'tcp:19222', 'localabstract:webview_devtools_remote_' + pid]);

const c = await connect();
try {
  console.log('Connected to WebView, initiating 4-step Vulkan accelerated generation...');
  const result = await c.evaluate(`(async () => {
    const t0 = Date.now();
    const res = await fetch('http://127.0.0.1:8789/sdapi/v1/txt2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '1girl, anime, smile, peaceful',
        width: 512,
        height: 512,
        steps: 4,
        cfg_scale: 1.8
      })
    });
    const cost = ((Date.now() - t0) / 1000).toFixed(1);
    const json = await res.json().catch(e => ({ error: e.message }));

    // Fetch logs
    const statusRes = await (await fetch('http://127.0.0.1:8787/api/android/media/local-engine/status')).json().catch(() => ({}));

    return {
      ok: res.ok,
      status: res.status,
      cost: cost + 's',
      hasImage: !!json.images?.[0],
      error: json.error,
      logs: statusRes.logs || []
    };
  })()`);
  console.log('Generation Result:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
