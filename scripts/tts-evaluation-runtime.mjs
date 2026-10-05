import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export async function loadEvaluationRuntime(){
 const source=await fs.readFile('app/src/main/assets/android-media.mjs'),hash=createHash('sha256').update(source).digest('hex');
 const root=path.resolve('artifacts/tts-evaluation/runtime-'+hash.slice(0,12));await fs.mkdir(path.join(root,'src/endpoints'),{recursive:true});
 await fs.writeFile(path.join(root,'android-media.mjs'),source);await fs.writeFile(path.join(root,'src/endpoints/secrets.js'),'export const readSecret=()=>"";export const writeSecret=()=>{};export const deleteSecret=()=>{};');
 return {backend:await import(pathToFileURL(path.join(root,'android-media.mjs'))),sourceHash:hash};
}
