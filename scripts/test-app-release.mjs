import assert from 'node:assert/strict';
import {parseAppRelease} from '../app/src/main/assets/android-updates.mjs';

const tag='v0.2-probe';
const base=`https://github.com/FORSTNOVA/xingzhan-tavern/releases/download/${tag}/`;
const release={tag_name:tag,name:'星栈酒馆',draft:false,html_url:`https://github.com/FORSTNOVA/xingzhan-tavern/releases/tag/${tag}`,assets:[
 {name:'sherpa-onnx-tts-engine.apk',state:'uploaded',size:190000000,browser_download_url:base+'sherpa-onnx-tts-engine.apk'},
 {name:'xingzhan-tavern-v0.2-probe.apk',state:'uploaded',size:180000000,digest:'sha256:'+'a'.repeat(64),browser_download_url:base+'xingzhan-tavern-v0.2-probe.apk'},
]};
const parsed=parseAppRelease(release);
assert.equal(parsed.apk.name,'xingzhan-tavern-v0.2-probe.apk');
assert.equal(parsed.apk.sha256,'a'.repeat(64));
assert.equal(parseAppRelease({...release,assets:[release.assets[0]]}).apk,null);
assert.equal(parseAppRelease({...release,assets:[{...release.assets[1],browser_download_url:'https://example.invalid/evil.apk'}]}).apk,null);
assert.throws(()=>parseAppRelease({...release,html_url:'https://example.invalid/tag'}),/发布地址无效/);
console.log('App release selection PASS');
