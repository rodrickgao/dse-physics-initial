import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {createApi} from '../server/api.mjs';

export const output=path.resolve(process.env.DSE_QA_OUTPUT || '../output/deep-site-test-20261012');
fs.mkdirSync(output,{recursive:true});
export async function fixture(name,options={}) {
 const directory=fs.mkdtempSync(path.join(tmpdir(),'ddphysics-deep-'+name+'-'));
 let now=Date.now(),api;
 const start=()=>createApi({directory,adminKey:'isolated-deep-test-key',clock:()=>now,qdnaDirectory:path.resolve(process.env.DSE_QA_QDNA_DIR || '../output/qdna-20261008'),...options});
 api=start();
 const root=path.resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.pdf':'application/pdf'};
 const server=createServer((req,res)=>api.handler(req,res,()=>{
  if(api.protectFiles(req,res))return;
  if(req.url==='/__qa_blank.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head></head><body></body></html>');return;}
  try {const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep)||!['GET','HEAD'].includes(req.method)||!fs.statSync(file).isFile())throw Error();res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);}catch {res.writeHead(404);res.end();}
 }));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/`,db=new DatabaseSync(path.join(directory,'students.sqlite'));
 function client() {
  const jar=new Map();
  const call=async(route,body,method='POST',headers={})=>{
   const response=await fetch(base+'api/'+route,{headers:{cookie:[...jar].map(([key,value])=>key+'='+value).join('; '),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{method,body:JSON.stringify(body)})});
   for(const value of response.headers.getSetCookie()){const [key,...rest]=value.split(';')[0].split('=');jar.set(key,rest.join('='));}
   const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
   return {status:response.status,data,headers:response.headers};
  };
  return {call,jar,cookie:()=>[...jar].map(([key,value])=>key+'='+value).join('; ')};
 }
 async function register(client,email,nickname='测试学生') {
  const code=await client.call('auth/code',{email});assert.equal(code.status,200,JSON.stringify(code.data));
  const auth=await client.call('auth/verify',{email,code:code.data.developmentCode});assert.equal(auth.status,200);
  const profile=await client.call('profile',{nickname,grade:'中五',target:'5*',region:'hong-kong',password:'Deep-local-test-123',confirmPassword:'Deep-local-test-123'},'PUT');assert.equal(profile.status,200,JSON.stringify(profile.data));
  return profile.data.user;
 }
 return {base,db,directory,server,client,register,clock:()=>now,advance:ms=>{now+=ms;},api:()=>api,restart:()=>{api.close();api=start();},close:async()=>{db.close();server.closeAllConnections();await new Promise(r=>server.close(r));api.close();}};
}
