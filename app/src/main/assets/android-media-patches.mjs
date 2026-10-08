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

const cardWorldScopeMarker = '// XINGZHAN_CARD_WORLD_SCOPE_V3';
const oldCardWorldScopeMarkers = ['// XINGZHAN_CARD_WORLD_SCOPE_V2', '// XINGZHAN_CARD_WORLD_SCOPE_V1'];

/**
 * Makes global and character-linked world books selectable per character card.
 * The native global selection remains intact; a card profile only changes the
 * books used while building prompts for that selected character.
 */
export async function patchCardWorldBookScope(root) {
 const file = path.join(root, 'public/scripts/world-info.js');
 let text = await fs.readFile(file, 'utf8');
 const lineEnding = text.includes('\r\n') ? '\r\n' : '\n';
 text = text.replace(/\r\n/g, '\n');
 if (text.includes(cardWorldScopeMarker)) return false;
 if (text.includes(oldCardWorldScopeMarkers[0])) {
  text = text.replace(oldCardWorldScopeMarkers[0], cardWorldScopeMarker);
  text = text.replace("content.css({ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 'min(620px, 82vw)' });", "content.css({ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' });");
  await fs.writeFile(file, text.replace(/\n/g, lineEnding), 'utf8');
  return true;
 }
 const oldCardWorldScopeMarker = oldCardWorldScopeMarkers.find(marker => text.includes(marker));
 if (oldCardWorldScopeMarker) {
  const oldStart = text.indexOf(oldCardWorldScopeMarker);
  const oldEnd = text.indexOf('async function getCharacterLore() {', oldStart);
  if (oldEnd < 0) throw new Error('旧版角色世界书补丁无法安全升级');
  text = text.slice(0, oldStart) + text.slice(oldEnd);
  if (oldCardWorldScopeMarker.endsWith('_V1')) {
   text = text.replace(`    const cardScope = getCharacterWorldBookScope();
        if (cardScope) {
        worldsToSearch = new Set([...worldsToSearch].filter(name => cardScope.has(name)));
    }

`, '');
  text = text.replace('if (getEffectiveGlobalWorldBooks().includes(worldName)) {', 'if (selected_world_info.includes(worldName)) {');
  text = text.replace('if (getEffectiveGlobalWorldBooks().includes(chatWorld)) {', 'if (selected_world_info.includes(chatWorld)) {');
  text = text.replace('if (getEffectiveGlobalWorldBooks().includes(personaWorld)) {', 'if (selected_world_info.includes(personaWorld)) {');
  text = text.replace(`export function initWorldInfo() {
    mountCardWorldBookPicker();
    $('#world_info').on('mousedown change', async function (e) {`, `export function initWorldInfo() {
    $('#world_info').on('mousedown change', async function (e) {`);
  text = text.replace(`async function getGlobalLore() {
    const activeWorldBooks = getEffectiveGlobalWorldBooks();
    if (!activeWorldBooks.length) {
        return [];
    }

    let entries = [];
    for (const worldName of activeWorldBooks) {`, `async function getGlobalLore() {
    if (!selected_world_info?.length) {
        return [];
    }

    let entries = [];
    for (const worldName of selected_world_info) {`);
   text = text.replace('console.debug(`[WI] Global world info has ${entries.length} entries`, getEffectiveGlobalWorldBooks());', 'console.debug(`[WI] Global world info has ${entries.length} entries`, selected_world_info);');
  }
 }

 const helperAnchor = 'async function getCharacterLore() {';
 if (!text.includes(helperAnchor)) throw new Error('角色世界书读取入口已变化，无法安装按角色卡筛选');
 const helpers = `${cardWorldScopeMarker}
function getCharacterBoundWorldBooks() {
 const character = characters[this_chid];
 if (!character) return [];
 const books = new Set();
 const primary = character.data?.extensions?.world;
 if (typeof primary === 'string' && primary) books.add(primary);
 const fileName = getCharaFilename(this_chid);
 const extra = world_info.charLore?.find(item => item.name === fileName)?.extraBooks;
 if (Array.isArray(extra)) for (const name of extra) if (typeof name === 'string' && name) books.add(name);
 return [...books];
}

function getCharacterWorldBookScope() {
 const character = characters[this_chid];
 if (!character) return null;
 const fileName = getCharaFilename(this_chid);
 if (!fileName) return null;
 const saved = world_info.characterWorldBooks?.[fileName];
 return new Set(Array.isArray(saved) ? saved.filter(name => typeof name === 'string' && name) : getCharacterBoundWorldBooks());
}

function getEffectiveGlobalWorldBooks() {
 const scope = getCharacterWorldBookScope();
 if (!scope) return selected_world_info ?? [];
 const characterBooks = new Set(getCharacterBoundWorldBooks());
 const chatBook = chat_metadata[METADATA_KEY];
 const personaBook = power_user.persona_description_lorebook;
 return [...scope].filter(name => !characterBooks.has(name) && name !== chatBook && name !== personaBook);
}

function getCardWorldBookStatus() {
 const character = characters[this_chid];
 if (!character) return '没有选中的单人角色卡；群聊和无角色聊天沿用酒馆原有的全局书设置。';
 const scope = getCharacterWorldBookScope() ?? new Set();
 const bound = getCharacterBoundWorldBooks();
 const missing = [...scope].filter(name => !world_names.includes(name));
 return '当前卡：' + (character.name || getCharaFilename(this_chid)) + '；生效 ' + scope.size + ' 本（角色关联 ' + bound.filter(name => scope.has(name)).length + '，其他书 ' + [...scope].filter(name => !bound.includes(name)).length + '）' + (missing.length ? '；' + missing.length + ' 本已不可用' : '');
}

async function openCardWorldBookPicker() {
 const character = characters[this_chid];
 if (!character) {
  toastr.info('请先打开单人角色卡聊天；群聊暂沿用酒馆原有世界书设置。');
  return;
 }
 const characterIndex = this_chid;
 const characterFile = getCharaFilename(characterIndex);
 const bound = new Set(getCharacterBoundWorldBooks());
 const selected = getCharacterWorldBookScope() ?? new Set(bound);
 const content = $('<div class="x-card-world-books"></div>');
 content.css({ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' });
 const hero = $('<div class="x-card-world-books-hero"></div>').css({ padding: '14px 16px', borderRadius: '10px', background: 'var(--SmartThemeBlurTintColor, rgba(80,120,160,.14))', border: '1px solid var(--SmartThemeBorderColor, #555)' });
 hero.append($('<strong></strong>').text('当前角色卡：' + (character.name || characterFile)));
 hero.append($('<p></p>').text('下面的选择会改变这张卡实际对话时参与扫描的世界书。不会改动其他角色卡，也不会改写酒馆的全局设置。'));
 const summary = $('<div class="x-card-world-books-summary" role="status"></div>').css({ fontWeight: '600', padding: '4px 2px' });
 const search = $('<input type="search" class="text_pole" placeholder="搜索世界书名称" aria-label="搜索世界书" />');
 const actions = $('<div class="x-card-world-books-actions"></div>').css({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', width: '100%' });
 const cardOnly = $('<button type="button" class="menu_button">恢复角色卡默认书单</button>');
 const clear = $('<button type="button" class="menu_button">全部关闭</button>');
 for (const button of [cardOnly, clear]) button.css({ width: '100%', minWidth: 0, minHeight: '42px', whiteSpace: 'normal', textAlign: 'center', flex: 'none', boxSizing: 'border-box' });
 actions.append(cardOnly, clear);
 const groups = $('<div class="x-card-world-books-groups"></div>').css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '12px', maxHeight: '55vh', overflowY: 'auto', padding: '2px' });
 const linkedGroup = $('<section class="x-card-world-books-group"></section>').css({ border: '1px solid var(--SmartThemeBorderColor, #555)', borderRadius: '10px', padding: '10px 12px' });
 const otherGroup = $('<section class="x-card-world-books-group"></section>').css({ border: '1px solid var(--SmartThemeBorderColor, #555)', borderRadius: '10px', padding: '10px 12px' });
 linkedGroup.append($('<h3></h3>').text('角色卡关联书').css({ margin: '2px 0 4px' }));
 linkedGroup.append($('<small></small>').text('主世界书和明确关联到这张卡的附加书；首次默认启用。'));
 otherGroup.append($('<h3></h3>').text('其他世界书 / 全局书').css({ margin: '2px 0 4px' }));
 otherGroup.append($('<small></small>').text('仅本卡手动勾选后生效；全局选择不会自动套用。'));
 const linkedList = $('<div class="x-card-world-books-list"></div>').css({ marginTop: '8px' });
 const otherList = $('<div class="x-card-world-books-list"></div>').css({ marginTop: '8px' });
 function addBook(name, isBound, unavailable = false) {
  const row = $('<label class="x-card-world-book-row"></label>').attr('data-world-name', name.toLocaleLowerCase());
  row.css({ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', alignItems: 'center', columnGap: '10px', padding: '9px 7px', marginTop: '4px', borderRadius: '7px', border: '1px solid var(--SmartThemeBorderColor, #555)', opacity: unavailable ? '.65' : '1' });
  const checkbox = $('<input type="checkbox" />').val(name).prop('checked', selected.has(name)).prop('disabled', unavailable);
  const text = $('<span></span>').css({ display: 'flex', flexDirection: 'column', minWidth: 0, overflowWrap: 'anywhere' });
  text.append($('<strong></strong>').text(name));
  text.append($('<small></small>').text(unavailable ? '关联书当前不可用' : isBound ? '角色卡绑定' : '仅对当前角色卡启用'));
  row.append(checkbox, text);
  (isBound ? linkedList : otherList).append(row);
 }
 for (const name of world_names ?? []) addBook(name, bound.has(name));
 for (const name of bound) if (!(world_names ?? []).includes(name)) addBook(name, true, true);
 if (!linkedList.children().length) linkedList.append($('<p></p>').text('这张卡没有自带或附加关联的世界书。'));
 if (!otherList.children().length) otherList.append($('<p></p>').text('还没有其他可选世界书。'));
 linkedGroup.append(linkedList);
 otherGroup.append(otherList);
 groups.append(linkedGroup, otherGroup);
 content.append(hero, summary, search, actions, groups);
 const refreshSummary = () => {
  const checked = content.find('input[type="checkbox"]:checked').length;
  const linkedChecked = linkedList.find('input[type="checkbox"]:checked').length;
  summary.text('本卡将启用 ' + checked + ' 本：角色关联 ' + linkedChecked + ' 本，其他书 ' + (checked - linkedChecked) + ' 本。');
 };
 content.on('change', 'input[type="checkbox"]', refreshSummary);
 refreshSummary();
 search.on('input', function () {
  const query = String($(this).val() ?? '').trim().toLocaleLowerCase();
  for (const row of content.find('.x-card-world-book-row')) $(row).toggle(!query || String($(row).attr('data-world-name')).includes(query));
 });
 cardOnly.on('click', () => { content.find('input[type="checkbox"]').each(function () { $(this).prop('checked', bound.has(String($(this).val()))); }); refreshSummary(); });
 clear.on('click', () => { content.find('input[type="checkbox"]').prop('checked', false); refreshSummary(); });
 const result = await callGenericPopup(content, POPUP_TYPE.CONFIRM, '', { wide: true, large: true, allowVerticalScrolling: true, okButton: '保存本卡设置', cancelButton: '取消' });
 if (result !== POPUP_RESULT.AFFIRMATIVE) return;
 if (this_chid !== characterIndex || getCharaFilename(this_chid) !== characterFile) {
  toastr.warning('当前角色卡已切换，请重新打开书单后保存。');
  return;
 }
 const books = content.find('input[type="checkbox"]:checked').map((_, item) => String($(item).val())).get();
 world_info.characterWorldBooks ??= {};
 world_info.characterWorldBooks[characterFile] = books;
 saveSettingsDebounced();
 eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
 $('#wiCardWorldBookStatus').text(getCardWorldBookStatus());
}

function mountCardWorldBookPicker() {
 if ($('#wiCardWorldBookSettings').length) return;
 const panel = $('<div id="wiCardWorldBookSettings"></div>').css({ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px', width: '100%', flex: '0 0 100%', boxSizing: 'border-box', padding: '8px 4px' });
 const button = $('<button id="wiCardWorldBookButton" type="button" class="menu_button">设置当前角色卡世界书</button>');
 const status = $('<small id="wiCardWorldBookStatus" role="status"></small>');
 button.css({ display: 'block', width: '100%', minHeight: '44px', whiteSpace: 'normal', textAlign: 'center', boxSizing: 'border-box' });
 status.css({ display: 'block', width: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: '1.4' });
 button.on('click', openCardWorldBookPicker);
 panel.append(button, status);
 $('#wiTopBlock').after(panel);
 const refresh = () => status.text(getCardWorldBookStatus());
 refresh();
 eventSource.on(event_types.CHAT_CHANGED, refresh);
 eventSource.on(event_types.CHARACTER_RENAMED, refresh);
}

`;
 text = text.replace(helperAnchor, helpers + helperAnchor);

 const characterLoreAnchor = `    if (!worldsToSearch.size) {
        return [];
    }`;
 if (!text.includes(characterLoreAnchor)) throw new Error('角色世界书筛选锚点已变化');
 text = text.replace(characterLoreAnchor, `    const cardScope = getCharacterWorldBookScope();
    if (cardScope) {
        worldsToSearch = new Set([...worldsToSearch].filter(name => cardScope.has(name)));
    }

${characterLoreAnchor}`);

 const globalSkip = 'if (selected_world_info.includes(worldName)) {';
 if (!text.includes(globalSkip)) throw new Error('角色世界书去重锚点已变化');
 text = text.replace(globalSkip, 'if (getEffectiveGlobalWorldBooks().includes(worldName)) {');
 const chatSkip = 'if (selected_world_info.includes(chatWorld)) {';
 if (!text.includes(chatSkip)) throw new Error('聊天世界书去重锚点已变化');
 text = text.replace(chatSkip, 'if (getEffectiveGlobalWorldBooks().includes(chatWorld)) {');
 const personaSkip = 'if (selected_world_info.includes(personaWorld)) {';
 if (!text.includes(personaSkip)) throw new Error('用户世界书去重锚点已变化');
 text = text.replace(personaSkip, 'if (getEffectiveGlobalWorldBooks().includes(personaWorld)) {');

 const globalLoreStart = `async function getGlobalLore() {
    if (!selected_world_info?.length) {
        return [];
    }

    let entries = [];
    for (const worldName of selected_world_info) {`;
 const globalLoreReplacement = `async function getGlobalLore() {
    const activeWorldBooks = getEffectiveGlobalWorldBooks();
    if (!activeWorldBooks.length) {
        return [];
    }

    let entries = [];
    for (const worldName of activeWorldBooks) {`;
 if (!text.includes(globalLoreStart)) throw new Error('全局世界书筛选锚点已变化');
 text = text.replace(globalLoreStart, globalLoreReplacement);
 text = text.replace('console.debug(`[WI] Global world info has ${entries.length} entries`, selected_world_info);', 'console.debug(`[WI] Global world info has ${entries.length} entries`, getEffectiveGlobalWorldBooks());');

 const initAnchor = `export function initWorldInfo() {
    $('#world_info').on('mousedown change', async function (e) {`;
 if (!text.includes(initAnchor)) throw new Error('世界书设置界面初始化锚点已变化');
 text = text.replace(initAnchor, `export function initWorldInfo() {
    mountCardWorldBookPicker();
    $('#world_info').on('mousedown change', async function (e) {`);

 await fs.writeFile(file, text.replace(/\n/g, lineEnding));
 return true;
}

export async function patchMedia(root,assetRoot){
 if(path.resolve(root)!==path.resolve(assetRoot))await fs.copyFile(path.join(assetRoot,'android-media.mjs'),path.join(root,'android-media.mjs'));
 for(const [file,edits] of Object.entries(legacy)){
  const target=path.join(root,file);let text;try{text=await fs.readFile(target,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const before=text;for(const [from,to] of edits)text=text.replace(from,to);if(text!==before)await fs.writeFile(target,text);
 }
 try {
  await patchCardWorldBookScope(root);
 } catch (error) {
  console.error('[XINGZHAN] Per-card worldbook scope could not be installed:', error);
 }
 const plugin=path.join(assetRoot,'.android-global-extensions','xingzhan-synthesis');await fs.mkdir(plugin,{recursive:true});
 const files=['manifest.json','index.js','media.js','style.css','system.js','kokoro-blend.js','mascot.js','mascot.png'];const hash=createHash('sha256');for(const name of files)hash.update(await fs.readFile(path.join(assetRoot,'xingzhan-synthesis-'+name)));const bundledHash=hash.digest('hex');
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
