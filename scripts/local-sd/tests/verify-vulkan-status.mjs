import {execFileSync} from 'node:child_process';
import {connect} from '../../webview-cdp.mjs';

const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const deviceId = 'ca168055';
const pid = execFileSync(adb, ['-s', deviceId, 'shell', 'pidof', 'cn.jiuguan.probe']).toString().trim();
execFileSync(adb, ['-s', deviceId, 'forward', 'tcp:19222', 'localabstract:webview_devtools_remote_' + pid]);

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    const res = await fetch('http://127.0.0.1:8787/api/android/media/local-engine/status');
    const text = await res.text();
    return { status: res.status, text };
  })()`);
  console.log('Result:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
