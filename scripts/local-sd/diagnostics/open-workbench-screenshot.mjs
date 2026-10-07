import {execFileSync} from 'node:child_process';
import {connect} from '../webview-cdp.mjs';

const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const deviceId = 'ca168055';
const pid = execFileSync(adb, ['-s', deviceId, 'shell', 'pidof', 'cn.jiuguan.probe']).toString().trim();
execFileSync(adb, ['-s', deviceId, 'forward', 'tcp:19222', 'localabstract:webview_devtools_remote_' + pid]);

const c = await connect();
try {
  await c.evaluate(`(() => {
    const details = document.querySelector('details');
    if (details) details.open = true;
    const allDetails = document.querySelectorAll('details');
    allDetails.forEach(d => d.open = true);
  })()`);

  // Wait 1s for animation
  await new Promise(r => setTimeout(r, 1000));

  const fs = await import('node:fs');
  const buf = execFileSync(adb, ['-s', deviceId, 'exec-out', 'screencap', '-p']);
  fs.writeFileSync('screen_workbench_live.png', buf);
  console.log('Saved screen_workbench_live.png');
} finally {
  c.close();
}
