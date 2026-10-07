import { connect } from '../../webview-cdp.mjs';

const c = await connect();
const res = await c.evaluate(`(async () => {
  const {mediaRequest} = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');

  // 1. Initial config
  const initialCfg = await (await mediaRequest('config/image')).json();

  // 2. Switch to ghostmix
  const switch1 = await (await mediaRequest('local-engine/model', { model: 'ghostmix.Q4_K_M.gguf' })).json();
  const cfgAfter1 = await (await mediaRequest('config/image')).json();
  const stAfter1 = await (await mediaRequest('local-engine/status')).json();

  // 3. Switch back to Counterfeit
  const switch2 = await (await mediaRequest('local-engine/model', { model: 'Counterfeit-V3.0_fix_fp16.safetensors' })).json();
  const cfgAfter2 = await (await mediaRequest('config/image')).json();
  const stAfter2 = await (await mediaRequest('local-engine/status')).json();

  return {
    initialSelected: initialCfg.selectedModel,
    step1: {
      cfgSelected: cfgAfter1.selectedModel,
      stSelected: stAfter1.selectedModel,
      stModelName: stAfter1.modelName
    },
    step2: {
      cfgSelected: cfgAfter2.selectedModel,
      stSelected: stAfter2.selectedModel,
      stModelName: stAfter2.modelName
    }
  };
})()`);

console.log('Model Switch Test Result:\n', JSON.stringify(res, null, 2));
process.exit(0);
