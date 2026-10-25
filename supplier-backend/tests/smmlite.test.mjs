import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler } from '../server.mjs';
const owner='synthetic-owner-token-for-testing-only-123';
const upstreamKey='synthetic-smmlite-provider-key-for-tests';
const env={SOCIALPANEL_OWNER_TOKEN:owner,SMMFOLLOWS_API_KEY:'synthetic-smmfollows-key',SMMLITE_API_KEY:upstreamKey};
const sample=[{service:1371,name:'Sample Subscribers',category:'YouTube',type:'Default',rate:'0.32',min:'50',max:'1000',refill:true}];
async function run(cb,options={}) {
  const calls=[];
  const handler=createHandler({env:options.env||env,supplierFetch:async(url,opts)=>{calls.push({url,opts});return opts.body.includes('action=balance')?Response.json({balance:'0.00',currency:'USD'}):Response.json(sample);}});
  const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const call=(provider,action='services',token=owner)=>fetch(base+'/api/preview',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify({provider,action})});
  try{await cb({base,call,calls});}finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('SMMLite is read-only and uses only its own private secret',async()=>{
  await run(async({call,calls})=>{
    const a=await call('smmlite');assert.equal(a.status,200);
    const data=await a.json();assert.equal(data.provider,'SMMLite');assert.equal(data.readOnly,true);
    assert.equal(data.services[0].service,1371);
    const b=await call('smmlite','balance');assert.equal(b.status,200);assert.equal((await b.json()).currency,'USD');
    assert.equal(calls.length,2);
    for(const c of calls){assert.equal(c.url,'https://smmlite.com/api/v2');
      const form=Object.fromEntries(new URLSearchParams(c.opts.body));assert.equal(form.key,upstreamKey);
      assert.deepEqual(Object.keys(form).sort(),['action','key']);assert.ok(['services','balance'].includes(form.action));
    }
  });
});
test('wrong owner token cannot reach the supplier and absent key fails closed',async()=>{
  await run(async({call,calls})=>{
    const a=await call('smmlite','services','different-token-that-is-long-enough');
    assert.equal(a.status,401);
    assert.equal(calls.length,0);
    const b=await call('smmlite');
    assert.equal(b.status,503);assert.match((await b.json()).error,/SMMLite key not configured/);
    const c=await call('smmfollows');
    assert.equal(c.status,200);
  },{env:{SOCIALPANEL_OWNER_TOKEN:owner,SMMFOLLOWS_API_KEY:'synthetic-smmfollows-key'}});
});
test('forbidden actions and unknown suppliers make no upstream requests',async()=>{
  await run(async({call,calls})=>{
    for(const provider of ['other','__proto__',null,23])assert.equal((await call(provider)).status,400);
    for(const action of ['add','order','cancel','refill','status','payment'])assert.equal((await call('smmlite',action)).status,400);
    assert.equal(calls.length,0);
  });
});
test('the private viewer offers two suppliers but never stores tokens',async()=>{
  await run(async({base})=>{
    const html=await (await fetch(base+'/admin')).text();
    const js=await (await fetch(base+'/admin/app.js')).text();
    assert.match(html,/value="smmfollows"/);
    assert.match(html,/value="smmlite"/);
    assert.match(js,/provider: selectedProvider/);
    assert.doesNotMatch(js,/(?:window\.|globalThis\.|\b)(?:localStorage|sessionStorage)\s*\.|document\.cookie/);
  });
});
