import { connect } from '../../webview-cdp.mjs';

const c = await connect();
const testResult = await c.evaluate(`(async () => {
  const select = document.querySelector('[data-image-quick-model]');
  if (!select) return { error: 'select not found' };

  // Select ghostmix
  select.value = 'local:ghostmix.Q4_K_M.gguf';
  select.dispatchEvent(new Event('change', { bubbles: true }));

  // Wait for async update
  await new Promise(r => setTimeout(r, 500));

  const { mediaRequest } = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
  const cfg = await (await mediaRequest('config/image')).json();
  const st = await (await mediaRequest('local-engine/status')).json();

  // Now select Counterfeit back
  select.value = 'local:Counterfeit-V3.0_fix_fp16.safetensors';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));

  const cfgFinal = await (await mediaRequest('config/image')).json();
  const stFinal = await (await mediaRequest('local-engine/status')).json();

  return {
    afterSelectGhost: {
      cfgSelected: cfg.selectedModel,
      stSelected: st.selectedModel,
      stModelName: st.modelName
    },
    afterSelectCounterfeit: {
      cfgSelected: cfgFinal.selectedModel,
      stSelected: stFinal.selectedModel,
      stModelName: stFinal.modelName
    }
  };
})()`);

console.log('UI Change Event Test Result:\n', JSON.stringify(testResult, null, 2));
process.exit(0);
