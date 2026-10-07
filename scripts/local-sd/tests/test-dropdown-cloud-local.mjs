import { connect } from '../../webview-cdp.mjs';

const c = await connect();
const testResult = await c.evaluate(`(async () => {
  const select = document.querySelector('[data-image-quick-model]');
  if (!select) return { error: 'select not found' };

  // Select Cloud Relay
  select.value = 'relay:gemini-3.1-flash-image';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));

  const { mediaRequest } = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
  const cfgRelay = await (await mediaRequest('config/image')).json();

  // Switch back to Local Counterfeit
  select.value = 'local:Counterfeit-V3.0_fix_fp16.safetensors';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));

  const cfgLocal = await (await mediaRequest('config/image')).json();
  const stLocal = await (await mediaRequest('local-engine/status')).json();

  return {
    afterSelectCloud: {
      source: cfgRelay.source,
      model: cfgRelay.model
    },
    afterSwitchBackLocal: {
      source: cfgLocal.source,
      selectedModel: cfgLocal.selectedModel,
      stModelName: stLocal.modelName
    }
  };
})()`);

console.log('Cloud vs Local Switch Test Result:\n', JSON.stringify(testResult, null, 2));
process.exit(0);
