import {execFileSync} from 'node:child_process';
import {connect} from './webview-cdp.mjs';
const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
execFileSync(adb, ['-s', 'ca168055', 'forward', 'tcp:19222', 'localabstract:webview_devtools_remote_5896']);

const c = await connect();
try {
  console.log('Reloading page...');
  await c.call('Page.reload');
  await new Promise(r => setTimeout(r, 4000));
  
  // Re-open synthesis popup or check state
  const state = await c.evaluate(`(() => {
    return {
      title: document.title,
      ready: typeof window.__apkSystemTtsAvailable !== 'undefined',
      token: !!window.__apkSystemTtsToken
    };
  })()`);
  console.log('Page reloaded, state:', JSON.stringify(state, null, 2));
} catch(e) {
  console.error('Error reloading:', e);
} finally {
  c.close();
}
