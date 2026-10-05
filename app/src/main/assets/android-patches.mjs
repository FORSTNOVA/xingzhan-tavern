import fs from 'node:fs/promises';
import path from 'node:path';
import { patchMedia } from './android-media-patches.mjs';

const startupMarker='/* XINGZHAN_STARTUP_TIMING_V1 */';
const startupBackup='.android-startup-script.backup';
const startupCharactersMarker='// XINGZHAN_STARTUP_TIMING_V1';
const startupCharactersBackup='.android-startup-characters.backup';
const startupSettingsMarker='// XINGZHAN_STARTUP_SETTINGS_TIMING_V1';
const startupSettingsBackup='.android-startup-settings.backup';
const startupExtensionsMarker='// XINGZHAN_STARTUP_EXTENSIONS_TIMING_V1';
const startupExtensionsBackup='.android-startup-extensions.backup';

async function restoreStartupFile(file,backup,marker){
 try{await fs.access(backup);}catch{return;}
 const text=await fs.readFile(file,'utf8');if(!text.includes(marker))return;
 try{await fs.rename(backup,file);}catch(error){throw new Error('启动计时已关闭，但无法恢复原文件：'+error.message);}
}

async function startupCharacters(root){
 const file=path.join(root,'src/endpoints/characters.js'),backup=path.join(root,startupCharactersBackup);
 let text=await fs.readFile(file,'utf8');if(text.includes(startupCharactersMarker))return;
 const routeAnchor="router.post('/all', async function (request, response) {";
 const routeStart=text.indexOf(routeAnchor);
 if(routeStart<0)throw new Error('角色列表接口计时入口已变化');
 const routeEnd=text.indexOf("router.post('/get'",routeStart);
 if(routeEnd<0)throw new Error('角色列表接口结束位置已变化');
 let route=text.slice(routeStart,routeEnd);
 route=route.replace(routeAnchor,`${startupCharactersMarker}\n${routeAnchor}\n    const __xRoute=performance.now();`);
 const sendAnchor='        return response.send(data);';
 if(!route.includes(sendAnchor))throw new Error('角色列表响应计时入口已变化');
 route=route.replace(sendAnchor,"        response.once('finish',()=>console.info('[XINGZHAN_STARTUP] characters-api count='+pngFiles.length+' result='+data.length+' total='+Math.round(performance.now()-__xRoute)+'ms'));\n"+sendAnchor);
 text=text.slice(0,routeStart)+route+text.slice(routeEnd);
 try{await fs.access(backup);}catch{await fs.copyFile(file,backup);}
 await fs.writeFile(file,text);
}

async function startupSettingsEndpoint(root){
 const file=path.join(root,'src/endpoints/settings.js'),backup=path.join(root,startupSettingsBackup);
 let text=await fs.readFile(file,'utf8');if(text.includes(startupSettingsMarker))return;
 const routeAnchor="router.post('/get', (request, response) => {";
 const routeStart=text.indexOf(routeAnchor);
 if(routeStart<0)throw new Error('设置接口计时入口已变化');
 const routeEnd=text.indexOf("router.post('/get-snapshots'",routeStart);
 if(routeEnd<0)throw new Error('设置接口结束位置已变化');
 let route=text.slice(routeStart,routeEnd);
 route=route.replace(routeAnchor,`${startupSettingsMarker}\n${routeAnchor}\n    const __xSettingsRoute=performance.now();`);
 const sendAnchor='    response.send({';
 if(!route.includes(sendAnchor))throw new Error('设置响应计时入口已变化');
 route=route.replace(sendAnchor,"    response.once('finish',()=>console.info('[XINGZHAN_STARTUP] settings-api total='+Math.round(performance.now()-__xSettingsRoute)+'ms settingsChars='+settings.length+' presets='+novelai_setting_names.length+openai_setting_names.length+textgenerationwebui_preset_names.length+koboldai_setting_names.length+' worlds='+worldFiles.length));\n"+sendAnchor);
 text=text.slice(0,routeStart)+route+text.slice(routeEnd);
 try{await fs.access(backup);}catch{await fs.copyFile(file,backup);}
 await fs.writeFile(file,text);
}

async function startupExtensions(root){
 const file=path.join(root,'public/scripts/extensions.js'),backup=path.join(root,startupExtensionsBackup);
 let text=await fs.readFile(file,'utf8');
 const activationStart=text.indexOf('async function activateExtensions() {');
 const activationEnd=text.indexOf('\nasync function connectClickHandler()',activationStart);
 if(activationStart<0||activationEnd<0)throw new Error('扩展激活计时区间已变化');
 let activation=text.slice(activationStart,activationEnd);
 if(!activation.includes('__xExtensionIndex')){
  activation=activation.replace('    const promises = [];',"    const promises = [];\n    let __xExtensionIndex=0;");
  activation=activation.replace('    for (let entry of extensions) {','    for (let entry of extensions) {\n        const __xExtensionStart=performance.now();');
  const itemAnchor='                promises.push(promise);';
  if(!activation.includes(itemAnchor))throw new Error('扩展单项计时入口已变化');
  activation=activation.replace(itemAnchor,"                console.info('[XINGZHAN_STARTUP] extensions-item '+(++__xExtensionIndex)+' '+Math.round(performance.now()-__xExtensionStart)+'ms');\n"+itemAnchor);
  activation='// XINGZHAN_STARTUP_EXTENSION_ITEMS\n'+activation;
 }
 text=text.slice(0,activationStart)+activation+text.slice(activationEnd);
 if(text.includes(startupExtensionsMarker)){
  await fs.writeFile(file,text);
  return;
 }
 const start=text.indexOf('export async function loadExtensionSettings(');
 const end=text.indexOf('\nexport function doDailyExtensionUpdatesCheck()',start);
 if(start<0||end<0)throw new Error('扩展加载计时区间已变化');
 let region=text.slice(start,end);
 region=region.replace('export async function loadExtensionSettings(settings, versionChanged, enableAutoUpdate) {',`${startupExtensionsMarker}\nexport async function loadExtensionSettings(settings, versionChanged, enableAutoUpdate) {`);
 const awaits=[
  ['await eventSource.emit(event_types.EXTENSIONS_FIRST_LOAD);',"await window.__xStartupMeasure('extensions-first-load',()=>eventSource.emit(event_types.EXTENSIONS_FIRST_LOAD));"],
  ['const extensions = await discoverExtensions();',"const extensions = await window.__xStartupMeasure('extensions-discover',()=>discoverExtensions());\n    console.info('[XINGZHAN_STARTUP] extensions-count '+extensions.length);"],
  ['manifests = await getManifests(extensionNames);',"manifests = await window.__xStartupMeasure('extensions-manifests',()=>getManifests(extensionNames));"],
  ['await autoUpdateExtensions(false);',"await window.__xStartupMeasure('extensions-auto-update',()=>autoUpdateExtensions(false));"],
  ['await activateExtensions();',"await window.__xStartupMeasure('extensions-activate',()=>activateExtensions());"],
 ];
 for(const [from,to] of awaits){if(region.includes(from))region=region.replace(from,to);else if(from!=='await autoUpdateExtensions(false);')throw new Error('扩展加载计时锚点缺失：'+from);}
 text=text.slice(0,start)+region+text.slice(end);
 try{await fs.access(backup);}catch{await fs.copyFile(file,backup);}
 await fs.writeFile(file,text);
}

export async function startupTiming(root,assetRoot){
 const flag=path.join(assetRoot,'.startup-timing-enabled');let enabled=false;
 try{await fs.access(flag);enabled=true;}catch{}
 const script=path.join(root,'public/script.js'),backup=path.join(root,startupBackup);
 if(!enabled){
  await restoreStartupFile(script,backup,startupMarker);
  await restoreStartupFile(path.join(root,'src/endpoints/characters.js'),path.join(root,startupCharactersBackup),startupCharactersMarker);
  await restoreStartupFile(path.join(root,'src/endpoints/settings.js'),path.join(root,startupSettingsBackup),startupSettingsMarker);
  await restoreStartupFile(path.join(root,'public/scripts/extensions.js'),path.join(root,startupExtensionsBackup),startupExtensionsMarker);
  return;
 }
 let text=await fs.readFile(script,'utf8');
 if(text.includes(startupMarker)){
  await startupCharacters(root);
  await startupSettingsEndpoint(root);
  await startupExtensions(root);
  return;
 }
 try{await fs.access(backup);}catch{await fs.copyFile(script,backup);}
 const anchor=/async function firstLoadInit\(\) \{\r?\n    try \{/;
 if(!anchor.test(text))throw new Error('酒馆启动入口已变化，无法安装临时计时');
 text=text.replace(anchor,`async function firstLoadInit() {\n    ${startupMarker}\n    const __xStart=performance.now();\n    const __xMeasure=async(name,run)=>{const t=performance.now();try{return await run();}finally{console.info('[XINGZHAN_STARTUP] '+name+' '+Math.round(performance.now()-t)+'ms');}};\n    console.info('[XINGZHAN_STARTUP] frontend-init-start');\n    try {`);
 const phases=[
  ['await getClientVersion();',"await __xMeasure('client-version',()=>getClientVersion());"],
  ['await initSecrets();',"await __xMeasure('init-secrets',()=>initSecrets());"],
  ['await readSecretState();',"await __xMeasure('read-secret-state',()=>readSecretState());"],
  ['await initLocales();',"await __xMeasure('init-locales',()=>initLocales());"],
  ['await initExtensions();',"await __xMeasure('init-extensions',()=>initExtensions());"],
  ['await initPresetManager();',"await __xMeasure('preset-manager',()=>initPresetManager());"],
  ['await initSystemMessages();',"await __xMeasure('system-messages',()=>initSystemMessages());"],
  ['await getSettings(initLoaderHandle);',"await __xMeasure('get-settings',()=>getSettings(initLoaderHandle));"],
  ['await checkOpenRouterAuth();',"await __xMeasure('check-auth',()=>checkOpenRouterAuth());"],
  ['await getUserAvatars(true, user_avatar);',"await __xMeasure('user-avatars',()=>getUserAvatars(true, user_avatar));"],
  ['await getCharacters();',"await __xMeasure('characters',()=>getCharacters());"],
  ['await getBackgrounds();',"await __xMeasure('backgrounds',()=>getBackgrounds());"],
  ['await initTokenizers();',"await __xMeasure('tokenizers',()=>initTokenizers());"],
  ['await initPersonas();',"await __xMeasure('personas',()=>initPersonas());"],
  ['await initSlashCommandAutoComplete();',"await __xMeasure('slash-autocomplete',()=>initSlashCommandAutoComplete());"],
  ['await initScrapers();',"await __xMeasure('scrapers',()=>initScrapers());"],
  ['await eventSource.emit(event_types.APP_INITIALIZED);',"await __xMeasure('app-initialized',()=>eventSource.emit(event_types.APP_INITIALIZED));"],
  ['await initLoaderHandle.hide();',"await __xMeasure('hide-loader',()=>initLoaderHandle.hide());"],
  ['await fixViewport();',"await __xMeasure('fix-viewport',()=>fixViewport());"],
  ['await eventSource.emit(event_types.APP_READY);',"await __xMeasure('app-ready',()=>eventSource.emit(event_types.APP_READY));\n    console.info('[XINGZHAN_STARTUP] frontend-total '+Math.round(performance.now()-__xStart)+'ms');"]
 ];
 for(const [from,to] of phases){if(!text.includes(from))throw new Error('酒馆启动计时锚点缺失：'+from);text=text.replace(from,to);}
 const getCharactersAnchor="    const response = await fetch('/api/characters/all', {";
 const getCharactersReplacement="    const response = await window.__xStartupMeasure('characters-api-wait',()=>fetch('/api/characters/all', {";
 if(!text.includes(getCharactersAnchor))throw new Error('角色列表请求计时入口已变化');
 text=text.replace(getCharactersAnchor,getCharactersReplacement);
 const fetchEnd=/        body: JSON\.stringify\(\{\}\),\r?\n    \}\);\r?\n    if \(response\.ok\) \{/;
 if(!fetchEnd.test(text))throw new Error('角色列表请求计时结束锚点已变化');
 text=text.replace(fetchEnd,"        body: JSON.stringify({}),\n    }));\n    if (response.ok) {");
 const jsonAnchor='        const getData = await response.json();';
 const jsonReplacement="        const getData = await window.__xStartupMeasure('characters-json',()=>response.json());";
 if(!text.includes(jsonAnchor))throw new Error('角色列表 JSON 计时入口已变化');
 text=text.replace(jsonAnchor,jsonReplacement);
 const groupsAnchor=/        await getGroups\(\);\r?\n        await printCharacters\(true\);/;
 if(!groupsAnchor.test(text))throw new Error('角色列表渲染计时入口已变化');
 text=text.replace(groupsAnchor,"        await window.__xStartupMeasure('characters-groups',()=>getGroups());\n        await window.__xStartupMeasure('characters-render',()=>printCharacters(true));");
 const settingsStart=text.indexOf('export async function getSettings(');
 const settingsEnd=text.indexOf('//MARK: saveSettings()',settingsStart);
 if(settingsStart<0||settingsEnd<0)throw new Error('设置加载计时区间已变化');
 let settingsRegion=text.slice(settingsStart,settingsEnd);
 const settingsFetch="    const response = await fetch('/api/settings/get', {";
 if(!settingsRegion.includes(settingsFetch))throw new Error('设置请求计时入口已变化');
 settingsRegion=settingsRegion.replace(settingsFetch,"    const response = await window.__xStartupMeasure('settings-api-wait',()=>fetch('/api/settings/get', {");
 const settingsFetchEnd=/        cache: 'no-cache',\r?\n    \}\);/;
 if(!settingsFetchEnd.test(settingsRegion))throw new Error('设置请求计时结束锚点已变化');
 settingsRegion=settingsRegion.replace(settingsFetchEnd,"        cache: 'no-cache',\n    }));");
 settingsRegion=settingsRegion.replace('    const data = await response.json();',"    const data = await window.__xStartupMeasure('settings-response-json',()=>response.json());");
 settingsRegion=settingsRegion.replace('        settings = JSON.parse(data.settings);',"        const __xSettingsParse=performance.now();\n        settings = JSON.parse(data.settings);\n        console.info('[XINGZHAN_STARTUP] settings-inner-parse '+Math.round(performance.now()-__xSettingsParse)+'ms chars='+data.settings.length);");
 const settingsAwaits=[
  ['await setUserControls(data.enable_accounts);',"await window.__xStartupMeasure('settings-user-controls',()=>setUserControls(data.enable_accounts));"],
  ['await eventSource.emit(event_types.SETTINGS_LOADED_BEFORE, settings);',"await window.__xStartupMeasure('settings-before-listeners',()=>eventSource.emit(event_types.SETTINGS_LOADED_BEFORE, settings));"],
  ['await loadTextGenSettings(data, settings);',"await window.__xStartupMeasure('settings-textgen',()=>loadTextGenSettings(data, settings));"],
  ['await loadPowerUserSettings(settings, data);',"await window.__xStartupMeasure('settings-power-user',()=>loadPowerUserSettings(settings, data));"],
  ['await eventSource.emit(event_types.SETTINGS_LOADED_AFTER, settings);',"await window.__xStartupMeasure('settings-after-listeners',()=>eventSource.emit(event_types.SETTINGS_LOADED_AFTER, settings));"],
  ['await loadExtensionSettings(settings, isVersionChanged, enableAutoUpdate);',"await window.__xStartupMeasure('settings-extensions',()=>loadExtensionSettings(settings, isVersionChanged, enableAutoUpdate));"],
  ['await eventSource.emit(event_types.EXTENSION_SETTINGS_LOADED);',"await window.__xStartupMeasure('settings-extension-listeners',()=>eventSource.emit(event_types.EXTENSION_SETTINGS_LOADED));"],
  ['await validateDisabledSamplers();',"await window.__xStartupMeasure('settings-validate-samplers',()=>validateDisabledSamplers());"],
  ['await eventSource.emit(event_types.SETTINGS_LOADED);',"await window.__xStartupMeasure('settings-loaded-listeners',()=>eventSource.emit(event_types.SETTINGS_LOADED));"],
 ];
 for(const [from,to] of settingsAwaits){if(!settingsRegion.includes(from))throw new Error('设置加载计时锚点缺失：'+from);settingsRegion=settingsRegion.replace(from,to);}
 text=text.slice(0,settingsStart)+settingsRegion+text.slice(settingsEnd);
 text=text.replace("const __xMeasure=async(name,run)=>{const t=performance.now();try{return await run();}finally{console.info('[XINGZHAN_STARTUP] '+name+' '+Math.round(performance.now()-t)+'ms');}};", "const __xMeasure=async(name,run)=>{const t=performance.now();try{return await run();}finally{console.info('[XINGZHAN_STARTUP] '+name+' '+Math.round(performance.now()-t)+'ms');}};\n    window.__xStartupMeasure=__xMeasure;");
 await fs.writeFile(script,text);
 await startupCharacters(root);
 await startupSettingsEndpoint(root);
 await startupExtensions(root);
}

async function applyAndroidCharacterListCache(root,assetRoot){
 const overlay=path.join(assetRoot,'android-characters.js');
 const overlayVersion=path.join(assetRoot,'android-characters.version');
 let version;
 try{version=(await fs.readFile(overlayVersion,'utf8')).trim();}catch{return;}
 const packageInfo=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 if(packageInfo.version!==version){console.warn('Skipping Android character cache overlay because the bundled SillyTavern version does not match');return;}
 await fs.copyFile(overlay,path.join(root,'src/endpoints/characters.js'));
}

async function shareGlobalExtensions(root,baseRoot){
 const shared=path.join(baseRoot,'.android-global-extensions');await fs.mkdir(shared,{recursive:true});
 const original=path.join(root,'public/scripts/extensions/third-party');await fs.mkdir(path.dirname(original),{recursive:true});
 let stat;try{stat=await fs.lstat(original);}catch{}
 if(stat?.isSymbolicLink()){
  if(await fs.realpath(original)!==await fs.realpath(shared))throw new Error('全局扩展目录链接异常');return;
 }
 if(stat){
  if(!stat.isDirectory())throw new Error('全局扩展目录不是文件夹');
  for(const name of await fs.readdir(original)){const destination=path.join(shared,name);try{await fs.lstat(destination);}catch{await fs.cp(path.join(original,name),destination,{recursive:true});}}
  // Keep the original as a recoverable migration copy, rather than deleting it.
  await fs.rename(original,original+'.before-apk-sharing-'+Date.now());
 }
 await fs.symlink(shared,original,process.platform==='win32'?'junction':'dir');
}
export async function patchRuntime(root,assetRoot){
 await patchMedia(root,assetRoot);
 await applyAndroidCharacterListCache(root,assetRoot);
 await startupTiming(root,assetRoot);
 if(path.resolve(root)!==path.resolve(assetRoot))for(const name of ['android-git.mjs','android-routes.mjs','android-downloads.js','android-probe.html'])await fs.copyFile(path.join(assetRoot,name),path.join(root,name));
 const extensions=path.join(root,'src/endpoints/extensions.js');let text=await fs.readFile(extensions,'utf8');
 const original="import { CheckRepoActions, default as simpleGit } from 'simple-git';";
 const replacement="import { CheckRepoActions, androidGit as simpleGit } from '../../android-git.mjs';";
 if(!text.includes(original)&&!text.includes(replacement))throw new Error('新版本扩展接口已变化，需更新 APK 后再升级');
 if(text.includes(original))await fs.writeFile(extensions,text.replace(original,replacement));
 const server=path.join(root,'src/server-main.js');text=await fs.readFile(server,'utf8');
 if(!text.includes('installAndroidRoutes(app)')){
  if(!text.includes('function apply404Middleware() {'))throw new Error('新版本服务器接口已变化，需更新 APK 后再升级');
  text="import {installAndroidRoutes, trackAndroidRequests} from '../android-routes.mjs';\n"+text.replace('function apply404Middleware() {','function apply404Middleware() {\n    installAndroidRoutes(app);').replace('setupPrivateEndpoints(app);','app.use(trackAndroidRequests);\nsetupPrivateEndpoints(app);');
  await fs.writeFile(server,text);
 }
 await shareGlobalExtensions(assetRoot,assetRoot);
 if(path.resolve(root)!==path.resolve(assetRoot))await shareGlobalExtensions(root,assetRoot);
}
