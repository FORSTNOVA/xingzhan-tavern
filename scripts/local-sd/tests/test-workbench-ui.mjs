import fs from 'node:fs';
import { connect } from '../../webview-cdp.mjs';

const c = await connect();
const uiInfo = await c.evaluate(`(async () => {
  const { openImageDialog } = await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js');
  await openImageDialog();

  // Wait a moment for dialog and models to sync
  await new Promise(r => setTimeout(r, 600));

  const dialog = document.querySelector('#xingzhan-image-dialog');
  const quickBar = dialog?.querySelector('[data-image-quick-bar]');
  const quickSelect = dialog?.querySelector('[data-image-quick-model]');
  const options = quickSelect ? Array.from(quickSelect.options).map(o => ({ value: o.value, text: o.text, selected: o.selected })) : [];

  return {
    dialogOpened: !!dialog?.open,
    quickBarFound: !!quickBar,
    quickSelectFound: !!quickSelect,
    currentValue: quickSelect?.value,
    options
  };
})()`);

console.log('Workbench UI Info:\n', JSON.stringify(uiInfo, null, 2));

// Capture screenshot of device screen
const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const { execFileSync } = await import('node:child_process');
execFileSync(adb, ['-s', 'ca168055', 'shell', 'screencap', '-p', '/sdcard/screen_model_switch.png']);
execFileSync(adb, ['-s', 'ca168055', 'pull', '/sdcard/screen_model_switch.png', 'screen_workbench_model_switch.png']);
console.log('Saved screenshot: screen_workbench_model_switch.png');

process.exit(0);
