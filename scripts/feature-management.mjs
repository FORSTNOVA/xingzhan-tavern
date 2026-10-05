import fs from 'node:fs';
import http from 'node:http';
function request(route,method='GET',headers={}){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:19788,path:route,method,headers},response=>{let body='';response.setEncoding('utf8');response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,text:body}));});r.on('error',reject);r.end();});}
const headers={'Host':'127.0.0.1:8788'};
const html=(await request('/manage','GET',headers)).text;
const token=html.match(/const token='([a-f0-9]{64})'/)?.[1];if(!token)throw Error('Management token unavailable');headers['X-Apk-Management']=token;
const action=process.argv[2]||'status';const response=await request('/manage/api/'+action,action==='status'?'GET':'POST',headers);const data=JSON.parse(response.text);
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({http:response.status,...data},null,2));console.log(JSON.stringify({http:response.status,...data},null,2));if(response.status>=400)process.exitCode=1;
