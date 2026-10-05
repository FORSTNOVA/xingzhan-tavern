import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const text = await c.evaluate(`document.querySelector('[data-system-preview]')?.textContent`);
  const status = await c.evaluate(`document.querySelector('[data-system-status]')?.textContent`);
  console.log('Preview button text now:', text);
  console.log('Status text now:', status);
} finally {
  c.close();
}
