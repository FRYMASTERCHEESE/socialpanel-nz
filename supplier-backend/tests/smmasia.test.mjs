import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler } from '../server.mjs';

const OWNER = 'example-admin-access-token-long-enough-not-real';
const KEY = 'example-smmasia-key-not-real';
const env = { SOCIALPANEL_OWNER_TOKEN: OWNER, SMMASIA_API_KEY: KEY };
async function withServer(callback, options = {}) {
  const server = createServer(createHandler({env:options.env ?? env,supplierFetch:options.supplierFetch ?? (async()=>Response.json([]))}));
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try {await callback('http://127.0.0.1:'+server.address().port);}
  finally {await new Promise(resolve=>server.close(resolve));}
}
async function request(base,action='services',provider='smmasia',token=OWNER){
  return fetch(base+'/api/preview',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},
    body:JSON.stringify({action,provider})});
}
test('SMMASIA sends only service and balance reads to a fixed supplier endpoint',async()=>{
 const calls=[];
 await withServer(async base=>{
   const a=await request(base);
   assert.equal(a.status,200);
   const list=await a.json();
   assert.equal(list.provider,'SMMASIA');
   assert.equal(list.readOnly,true);
   assert.deepEqual(list.services.map(x=>[x.service,x.rate]),[[700,'0.05'],[701,'0.25']]);
   assert.equal(list.rejected,1);
   const b=await request(base,'balance');
   assert.equal(b.status,200);
   assert.deepEqual(await b.json(),{provider:'SMMASIA',readOnly:true,balance:'0.00',currency:'USD'});
   for(const action of ['add','cancel','refill','status'])assert.equal((await request(base,action)).status,400);
 },{supplierFetch:async(url,init)=>{
   const params=Object.fromEntries(new URLSearchParams(init.body));
   calls.push({url,method:init.method,redirect:init.redirect,params});
   return Response.json(params.action==='services'?
     [{service:700,name:'Illustrative Facebook service',category:'Facebook',rate:0.05,min:100,max:100000},
      {service:700,name:'Duplicate',category:'Facebook',rate:0.06,min:100,max:100000},
      {service:701,name:'Illustrative Video service',category:'YouTube',rate:'0.25',min:'10',max:'10000'}]
     :{balance:'0.00',currency:'USD'});
 }});
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.url==='https://smmasia.org/api/v2'&&x.method==='POST'&&x.redirect==='error'));
 assert.deepEqual(calls.map(x=>x.params),[{key:KEY,action:'services'},{key:KEY,action:'balance'}]);
});
test('SMMASIA is private and fails closed without credentials',async()=>{
 let calls=0;
 await withServer(async base=>{
   const missing=await request(base);
   assert.equal(missing.status,503);
   assert.match((await missing.json()).error,/SMMASIA key not configured/);
   assert.equal((await request(base,'services','smmasia','incorrect-long-test-token-12345')).status,401);
   assert.equal((await request(base,'services','https://invalid.example')).status,400);
   const anonymous=await fetch(base+'/api/preview',{method:'POST',
     headers:{'content-type':'application/json'},body:'{"provider":"smmasia","action":"services"}'});
   assert.equal(anonymous.status,401);
   const html=await(await fetch(base+'/admin')).text();
   for(const id of ['smmfollows','smmlite','daosmm','likeo','alhitaan','smmasia']){
     assert.ok(html.includes('option value="'+id+'"'));
   }
 },{env:{SOCIALPANEL_OWNER_TOKEN:OWNER},supplierFetch:async()=>{calls++;return Response.json([])}});
 assert.equal(calls,0);
});
