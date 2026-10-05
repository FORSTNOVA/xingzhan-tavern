import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {patchMedia} from '../app/src/main/assets/android-media-patches.mjs';
const root=path.resolve('artifacts/relay/standalone-patch-fixture'),assets=path.join(root,'assets');await fs.mkdir(assets,{recursive:true});
for(const name of ['android-media.mjs',...['manifest.json','index.js','media.js','style.css','system.js'].map(n=>'xingzhan-synthesis-'+n)])await fs.copyFile(path.join('app/src/main/assets',name),path.join(assets,name));
const files=['public/scripts/extensions/tts/index.js','public/scripts/extensions/stable-diffusion/settings.html','public/scripts/extensions/stable-diffusion/index.js'];
for(const file of files){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.copyFile(path.join('vendor/SillyTavern',file),path.join(root,file));}
const originals=await Promise.all(files.map(f=>fs.readFile(path.join(root,f),'utf8')));
const user=path.join(assets,'data/default-user');await fs.mkdir(user,{recursive:true});
await fs.writeFile(path.join(user,'settings.json'),JSON.stringify({chat:'preserve',extension_settings:{tts:{currentProvider:'星栈 Gemini TTS',enabled:true,voiceMap:{keep:'Kore'}},sd:{google_api:'xingzhan',width:1024}}}));
await fs.writeFile(path.join(user,'xingzhan-media.json'),'{"tts":{"model":"alias"}}');await fs.writeFile(path.join(user,'secrets.json'),'{"api_key_xingzhan_tts":"fake"}');
await patchMedia(root,assets);assert.deepEqual(await Promise.all(files.map(f=>fs.readFile(path.join(root,f),'utf8'))),originals);
const migrated=JSON.parse(await fs.readFile(path.join(user,'settings.json'),'utf8'));assert.equal(migrated.extension_settings.tts.currentProvider,'OpenAI Compatible');assert.equal(migrated.extension_settings.tts.enabled,false);assert.equal(migrated.extension_settings.sd.google_api,'makersuite');assert.equal(migrated.chat,'preserve');assert.equal(migrated.extension_settings.sd.width,1024);assert.equal(await fs.readFile(path.join(user,'secrets.json'),'utf8'),'{"api_key_xingzhan_tts":"fake"}');assert.equal(await fs.readFile(path.join(user,'xingzhan-media.json'),'utf8'),'{"tts":{"model":"alias"}}');
// Representative old TTS integration plus unrelated user edit.
await fs.writeFile(path.join(root,files[0]),originals[0].replace("import { OpenAICompatibleTtsProvider } from './openai-compatible.js';","import { OpenAICompatibleTtsProvider } from './openai-compatible.js';\nimport { XingzhanTtsProvider } from '../xingzhan-media.js';").replace("'OpenAI Compatible': OpenAICompatibleTtsProvider,","'OpenAI Compatible': OpenAICompatibleTtsProvider,\n    '星栈 Gemini TTS': XingzhanTtsProvider,").replace('function resetTtsPlayback() {','function resetTtsPlayback() {\n    ttsProvider?.cancel?.();')+'\n// user edit preserved');
await patchMedia(root,assets);assert.equal(await fs.readFile(path.join(root,files[0]),'utf8'),originals[0]+'\n// user edit preserved');
const plugin=path.join(assets,'.android-global-extensions/xingzhan-synthesis');await fs.appendFile(path.join(plugin,'index.js'),'\n// independent plugin edit');await patchMedia(root,assets);assert.ok((await fs.readFile(path.join(plugin,'index.js'),'utf8')).endsWith('// independent plugin edit'));
const result={passed:['独立插件安装，原始官方源码不被修改','旧官方入口迁移，其他设置保留','媒体模型与令牌文件原样保留','旧 TTS 代码钩子精确移除，用户其他改动保留','重复启动不覆盖独立插件修改']};await fs.writeFile('artifacts/relay/patch-validation.json',JSON.stringify(result,null,2));console.log(result);
