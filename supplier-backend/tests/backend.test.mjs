import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler } from '../server.mjs';

const token = 'only-for-tests-an-owner-token-1234567890';
const key = 'test-provider-secret-do-not-use';
const env = { SOCIALPANEL_OWNER_TOKEN: token, SMMFOLLOWS_API_KEY: key };
const data = [
  { service: 123, name: 'Video Views', type: 'Default', category: 'Example / Video', rate: '0.09', min: '100', max: '10000', refill: true, cancel: false },
  { service: 123, name: 'Duplicate', category: 'Example', rate: '0.20', min: '100', max: '10000' },
  { service: 124, name: 'Likes', type: 'Default', category: 'Example / Likes', rate: '1.23', min: '50', max: '5000', refill: false, cancel: true },
];

async function withServer(callback, options = {}) {
  const server = createServer(createHandler({ env: options.env ?? env, supplierFetch: options.supplierFetch ?? (async () => Response.json(data)) }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await callback(base); }
  finally { await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
const post = (base, action, access = token, headers = {}) => fetch(base + '/api/preview', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + access, ...headers },
  body: JSON.stringify({ action }),
});

test('health is public and explicitly read-only', async () => {
  await withServer(async base => {
    const response = await fetch(base + '/healthz');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', product: 'SocialPanel NZ supplier preview', readOnly: true, ordersEnabled: false });
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  });
});
test('static private viewer serves protected HTML and no external scripts', async () => {
  await withServer(async base => {
    const response = await fetch(base + '/admin');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Private supplier console/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.doesNotMatch(html, /localStorage|https:\/\/cdn/i);
    assert.equal((await fetch(base + '/admin/app.js')).status, 200);
  });
});
test('unauthenticated request rejected without supplier call', async () => {
  let calls = 0;
  await withServer(async base => {
    const r = await post(base, 'services', 'wrong-owner-token-that-is-long-enough');
    assert.equal(r.status, 401);
  }, { supplierFetch: async () => { calls++; return Response.json(data); } });
  assert.equal(calls, 0);
});
test('missing secrets fail closed', async () => {
  await withServer(async base => {
    const r = await post(base, 'services');
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /Private environment setup incomplete/);
  }, { env: {} });
});
test('only services and balance are allowed; never orders, refills or payments', async () => {
  let calls = 0;
  await withServer(async base => {
    for (const action of ['add', 'order', 'refill', 'cancel', 'refund', '']) {
      const r = await post(base, action);
      assert.equal(r.status, 400);
    }
    const r = await fetch(base + '/api/orders', {method: 'POST'});
    assert.equal(r.status, 404);
  }, { supplierFetch: async () => { calls++; return Response.json(data); } });
  assert.equal(calls, 0);
});
test('supplier request uses fixed URL, form POST and read-only action', async () => {
  let request;
  await withServer(async base => {
    const r = await post(base, 'services');
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.provider, 'SMMFollows');
    assert.equal(result.readOnly, true);
    assert.equal(result.currency, 'UNVERIFIED');
    assert.equal(result.listed, 3);
    assert.equal(result.valid, 2);
    assert.equal(result.rejected, 1);
    assert.deepEqual(result.services.map(x => [x.service, x.rate, x.min, x.max]), [[123,'0.09',100,10000],[124,'1.23',50,5000]]);
  }, { supplierFetch: async (url, init) => { request = {url,init}; return Response.json(data); } });
  assert.equal(request.url, 'https://smmfollows.com/api/v2');
  assert.equal(request.init.method, 'POST');
  const params = new URLSearchParams(request.init.body);
  assert.deepEqual(Object.fromEntries(params.entries()), {key, action:'services'});
  assert.equal(request.init.redirect,'error');
});
test('private balance returned only on authorised request', async () => {
  await withServer(async base => {
    const r = await post(base, 'balance');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {provider:'SMMFollows',readOnly:true,balance:'12.34',currency:'USD'});
  }, {supplierFetch:async () => Response.json({balance:'12.34',currency:'USD'})});
});
test('malformed upstream errors are sanitized and do not reveal credentials', async () => {
  await withServer(async base => {
    const r = await post(base, 'services');
    assert.equal(r.status, 502);
    const body = JSON.stringify(await r.json());
    assert.doesNotMatch(body, /test-provider-secret|only-for-tests/);
  }, {supplierFetch:async () => new Response('{invalid JSON', {status:200, headers:{'content-type':'application/json'}})});
});
test('cross-origin requests rejected without reading supplier data', async () => {
  let calls=0;
  await withServer(async base => {
    const r = await post(base, 'services', token, {'Origin':'https://evil.example'});
    assert.equal(r.status,403);
  }, {supplierFetch:async ()=>{calls++;return Response.json(data);}});
  assert.equal(calls,0);
});
test('anonymous browser cannot access owner API', async () => {
  await withServer(async base => {
    const r = await fetch(base+'/api/preview',{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"services"}'});
    assert.equal(r.status,401);
  });
});
test('content type and oversized request are rejected', async () => {
  await withServer(async base => {
    const wrong = await fetch(base + '/api/preview', {method:'POST',headers:{authorization:'Bearer '+token,'content-type':'text/plain'},body:'services'});
    assert.equal(wrong.status,415);
    const huge = await post(base, 'services', token, {'content-type':'application/json','content-length':'2000'}).catch(()=>null);
    // Node's fetch may reject a mismatched Content-Length before HTTP submission.
    if (huge) assert.equal(huge.status,413);
  });
});


test('large legitimate catalogue above old 2MB limit is accepted and loads up to 5000 valid entries', async () => {
  const big = Array.from({length:6600},(_,i)=>({service:i+1,name:'Test sample '+ 'x'.repeat(140),
    category:'Test / '+ 'y'.repeat(75),type:'Default',rate:'0.12',min:'100',max:'100000',refill:false}));
  const bytes = Buffer.byteLength(JSON.stringify(big));
  assert.ok(bytes>2_000_000&&bytes<12_000_000, `Unexpected fixture size ${bytes}`);
  await withServer(async base=>{
    const r=await post(base,'services');
    assert.equal(r.status,200);
    const result=await r.json();
    assert.equal(result.listed,6600);
    assert.equal(result.valid,6600);
    assert.equal(result.services.length,5000);
    assert.equal(result.truncated,true);
    assert.equal(result.readOnly,true);
  },{supplierFetch:async()=>Response.json(big)});
});

test('HTTP 403 and provider errors show safe distinct messages, never secret values', async () => {
  await withServer(async base=>{
    const r=await post(base,'services');
    assert.equal(r.status,502);
    const body=await r.json();
    assert.equal(body.code,'SUPPLIER_ACCESS_DENIED');
    assert.match(body.error,/HTTP 403/);
    assert.doesNotMatch(JSON.stringify(body), /test-provider-secret|only-for-tests/);
  },{supplierFetch:async()=>new Response('some sensitive provider error',{status:403})});
  await withServer(async base=>{
    const r=await post(base,'balance');
    assert.equal(r.status,502);
    assert.equal((await r.json()).code,'SUPPLIER_REJECTED');
  },{supplierFetch:async()=>Response.json({error:'Invalid key: '+key})});
});

test('invalid JSON, rate limits, catalogue size and invalid data have distinct safe codes', async () => {
  const samples=[
    [new Response('<html>Security challenge</html>',{status:200}),'SUPPLIER_NOT_JSON'],
    [new Response('',{status:429}),'SUPPLIER_RATE_LIMIT'],
    [new Response('[]',{status:200,headers:{'content-length':'15000000'}}),'SUPPLIER_TOO_LARGE'],
    [Response.json({unknown:1}),'SUPPLIER_FORMAT'],
  ];
  for(const [reply,expected] of samples){
    await withServer(async base=>{
      const r=await post(base,'services');
      assert.equal(r.status,502);
      const body=await r.json();
      assert.equal(body.code,expected);
      assert.equal(typeof body.error,'string');
    },{supplierFetch:async()=>reply});
  }
});


test('excluded rows report individual reasons without echoing supplier data', async () => {
  const mixed = [
    ...data,
    null,
    {service:'bad',name:'X',rate:'0.01',min:'1',max:'100'},
    {service:201,name:'',rate:'0.01',min:'1',max:'100'},
    {service:202,name:'Y',rate:'invalid',min:'1',max:'100'},
    {service:203,name:'Z',rate:'0.01',min:'0',max:'100'},
  ];
  await withServer(async base=>{
    const r = await post(base,'services');
    assert.equal(r.status,200);
    const result=await r.json();
    assert.equal(result.valid,2);
    assert.equal(result.rejected,6);
    assert.deepEqual(result.rejectedReasons,{
      invalidRecord:1,invalidId:1,missingName:1,invalidRate:1,invalidQuantityRange:1,duplicateId:1
    });
    assert.equal(result.rejected+result.valid,result.listed);
    assert.doesNotMatch(JSON.stringify(result),/invalid JSON|test-provider-secret/);
  },{supplierFetch:async()=>Response.json(mixed)});
});

test('DaoSMM uses isolated secret and fixed v2 endpoint for read-only services and balance', async () => {
  const daoKey = 'synthetic-dao-secret-not-for-production';
  const calls = [];
  const postDao = (base, action) => fetch(base + '/api/preview', {
    method: 'POST',
    headers: {'content-type':'application/json','authorization':'Bearer '+token},
    body: JSON.stringify({action,provider:'daosmm'}),
  });
  await withServer(async base => {
    const services = await postDao(base, 'services');
    assert.equal(services.status, 200);
    const servicesBody = await services.json();
    assert.equal(servicesBody.provider,'DaoSMM');
    assert.equal(servicesBody.readOnly,true);
    assert.equal(servicesBody.services.length,2);
    const balance = await postDao(base, 'balance');
    assert.equal(balance.status,200);
    assert.deepEqual(await balance.json(),{provider:'DaoSMM',readOnly:true,balance:'4.20',currency:'USD'});
    const denied = await postDao(base, 'add');
    assert.equal(denied.status,400);
  }, {
    env: {...env,DAOSMM_API_KEY:daoKey},
    supplierFetch: async (url,init) => {
      const data = Object.fromEntries(new URLSearchParams(init.body).entries());
      calls.push({url,method:init.method,redirect:init.redirect,form:data});
      return Response.json(data.action==='services' ? [
        {service:8719,name:'YouTube Subscribers',category:'YouTube',rate:'3.00',min:'100',max:'10000'},
        {service:8719,name:'duplicate',rate:'5.00',min:'100',max:'10000'},
        {service:8720,name:'Views',category:'YouTube',rate:'1.00',min:'100',max:'10000'},
      ] : {balance:'4.20',currency:'USD'});
    }
  });
  assert.equal(calls.length,2);
  assert.deepEqual(calls.map(x=>x.url),['https://daosmm.com/api/v2','https://daosmm.com/api/v2']);
  assert.deepEqual(calls.map(x=>x.form),[
    {key:daoKey,action:'services'},{key:daoKey,action:'balance'}
  ]);
  assert.ok(calls.every(x=>x.method==='POST' && x.redirect==='error'));
});

test('DaoSMM refuses missing key, unknown provider, and unsigned access without supplier requests', async () => {
  let calls=0;
  const send = (base,payload,auth=token) => fetch(base+'/api/preview',{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+auth},
    body:JSON.stringify(payload)
  });
  await withServer(async base => {
    const missing = await send(base,{action:'services',provider:'daosmm'});
    assert.equal(missing.status,503);
    assert.match((await missing.json()).error,/DaoSMM key not configured/);
    const unknown = await send(base,{action:'services',provider:'https://evil.test'});
    assert.equal(unknown.status,400);
    const unauthorized = await send(base,{action:'services',provider:'daosmm'},'a-wrong-owner-token-over-24-chars');
    assert.equal(unauthorized.status,401);
    const hidden = await fetch(base+'/api/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'balance',provider:'daosmm'})});
    assert.equal(hidden.status,401);
  },{env,supplierFetch:async()=>{calls++;return Response.json({balance:'1',currency:'USD'});}});
  assert.equal(calls,0);
});

test('Admin selector explicitly includes all three suppliers',async()=>{
  await withServer(async base=>{
    const res=await fetch(base+'/admin');
    assert.equal(res.status,200);
    const html=await res.text();
    assert.match(html,/option value="smmfollows"/);
    assert.match(html,/option value="smmlite"/);
    assert.match(html,/option value="daosmm"/);
  });
});


test('Likeo API uses separate secret, fixed endpoint and read-only actions',async()=>{
  const fakeKey='synthetic-likeo-api-key-for-test';
  const calls=[];
  const make=(base,action)=>fetch(base+'/api/preview',{
    method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+token},
    body:JSON.stringify({provider:'likeo',action})
  });
  await withServer(async base=>{
    const r=await make(base,'services');
    assert.equal(r.status,200);
    const result=await r.json();
    assert.equal(result.provider,'Likeo');
    assert.equal(result.readOnly,true);
    assert.deepEqual(result.services.map(x=>x.service),[8801,8802]);
    const b=await make(base,'balance');
    assert.equal(b.status,200);
    assert.deepEqual(await b.json(),{provider:'Likeo',readOnly:true,balance:'5.10',currency:'USD'});
    const bad=await make(base,'add');
    assert.equal(bad.status,400);
  },{
    env:{...env,LIKEO_API_KEY:fakeKey},
    supplierFetch:async (url,options)=>{
      const p=Object.fromEntries(new URLSearchParams(options.body).entries());
      calls.push({url,options,p});
      return Response.json(p.action==='services'?[
        {service:8801,category:'YouTube',name:'Sample Service',rate:'0.20',min:'10',max:'1000',refill:false},
        {service:8801,category:'YouTube',name:'Duplicate',rate:'0.30',min:'10',max:'1000',refill:false},
        {service:8802,category:'YouTube',name:'Another Service',rate:'0.40',min:'10',max:'1000',refill:false}
      ]:{balance:'5.10',currency:'USD'});
    }
  });
  assert.deepEqual(calls.map(c=>c.url),['https://likeo.net/api/v2','https://likeo.net/api/v2']);
  assert.deepEqual(calls.map(c=>c.p),[
    {key:fakeKey,action:'services'},{key:fakeKey,action:'balance'}
  ]);
  assert.ok(calls.every(c=>c.options.method==='POST'&&c.options.redirect==='error'));
});

test('Likeo fails closed without its key and denies unauthorized or unknown requests',async()=>{
  let upstreamCalls=0;
  const send=(base,provider,access=token)=>fetch(base+'/api/preview',{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+access},
    body:JSON.stringify({provider,action:'services'})
  });
  await withServer(async base=>{
    const miss=await send(base,'likeo');
    assert.equal(miss.status,503);
    assert.match((await miss.json()).error,/Likeo key not configured/);
    const bad=await send(base,'likeo','incorrect-owner-token-that-is-long-enough');
    assert.equal(bad.status,401);
    const unknown=await send(base,'https://evil.test');
    assert.equal(unknown.status,400);
    const noAuth=await fetch(base+'/api/preview',{method:'POST',
      headers:{'content-type':'application/json'},body:'{"action":"balance","provider":"likeo"}'});
    assert.equal(noAuth.status,401);
    const html=await (await fetch(base+'/admin')).text();
    for(const supplier of ['smmfollows','smmlite','daosmm','likeo']){
      assert.match(html,new RegExp('option value="'+supplier+'"'));
    }
  },{env,supplierFetch:async()=>{upstreamCalls++;return Response.json([])}});
  assert.equal(upstreamCalls,0);
});
