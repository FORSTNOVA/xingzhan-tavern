import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
// Remove our exact legacy hooks, preserving other upstream edits.
const legacy={
 'public/scripts/extensions/tts/index.js':[
  ["\nimport { XingzhanTtsProvider } from '../xingzhan-media.js';",''],
  ["\n    '星栈 Gemini TTS': XingzhanTtsProvider,",''],
  ['function resetTtsPlayback() {\n    ttsProvider?.cancel?.();','function resetTtsPlayback() {'],
 ],
 'public/scripts/extensions/stable-diffusion/settings.html':[
  ['\n                            <option value="xingzhan">星栈 Gemini 中转（AI Studio / Vertex）</option>',''],
 ],
 'public/scripts/extensions/stable-diffusion/index.js':[
  ["import {relayImageModels, relayImage, initImageRelay} from '../xingzhan-media.js';\n",''],
  ["async function loadGoogleModels() {\n    if (extension_settings.sd.google_api === 'xingzhan') return relayImageModels();",'async function loadGoogleModels() {'],
  ["async function generateGoogleImage(prompt, negativePrompt, signal) {\n    if (extension_settings.sd.google_api === 'xingzhan') return relayImage(prompt, getClosestAspectRatio(extension_settings.sd.width, extension_settings.sd.height, 'google'), signal);",'async function generateGoogleImage(prompt, negativePrompt, signal) {'],
  ["return extension_settings.sd.google_api === 'xingzhan' ? !!window.__xingzhanImageReady : secret_state[SECRET_KEYS.MAKERSUITE] || secret_state[SECRET_KEYS.VERTEXAI] || secret_state[SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT];",'return secret_state[SECRET_KEYS.MAKERSUITE] || secret_state[SECRET_KEYS.VERTEXAI] || secret_state[SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT];'],
  ["initImageRelay();\n    $('#sd_google_api').on('input', function () {","$('#sd_google_api').on('input', function () {"],
 ],
};
export async function patchMedia(root,assetRoot){
 if(path.resolve(root)!==path.resolve(assetRoot))await fs.copyFile(path.join(assetRoot,'android-media.mjs'),path.join(root,'android-media.mjs'));
 for(const [file,edits] of Object.entries(legacy)){
  const target=path.join(root,file);let text;try{text=await fs.readFile(target,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const before=text;for(const [from,to] of edits)text=text.replace(from,to);if(text!==before)await fs.writeFile(target,text);
 }
 const plugin=path.join(assetRoot,'.android-global-extensions','xingzhan-synthesis');await fs.mkdir(plugin,{recursive:true});
 const files=['manifest.json','index.js','media.js','style.css','system.js'];const hash=createHash('sha256');for(const name of files)hash.update(await fs.readFile(path.join(assetRoot,'xingzhan-synthesis-'+name)));const bundledHash=hash.digest('hex');
 let installedHash;try{installedHash=await fs.readFile(path.join(plugin,'.apk-bundle-hash'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 if(installedHash!==bundledHash){for(const name of files)await fs.copyFile(path.join(assetRoot,'xingzhan-synthesis-'+name),path.join(plugin,name));await fs.writeFile(path.join(plugin,'.apk-bundle-hash'),bundledHash);}
 const users=path.join(assetRoot,'data');let entries=[];try{entries=await fs.readdir(users,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const user of entries.filter(entry=>entry.isDirectory())){
  const file=path.join(users,user.name,'settings.json');let settings;try{settings=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const ext=settings.extension_settings;let changed=false;
  if(ext?.tts?.currentProvider==='星栈 Gemini TTS'){ext.tts.currentProvider='OpenAI Compatible';ext.tts.enabled=false;changed=true;}
  if(ext?.sd?.google_api==='xingzhan'){ext.sd.google_api='makersuite';changed=true;}
  if(changed){const backup=file+'.before-synthesis-plugin';try{await fs.copyFile(file,backup,fs.constants.COPYFILE_EXCL);}catch(error){if(error.code!=='EEXIST')throw error;}await fs.writeFile(file+'.synthesis-tmp',JSON.stringify(settings));await fs.rename(file+'.synthesis-tmp',file);}
 }
}
