import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSupplierList, normalizeSupplierBalance} from '../supabase/functions/smmfollows-preview/normalize.mjs';

const example=[
  {service:1,name:'Followers',type:'Default',category:'Example',rate:'0.90',min:'50',max:'10000',refill:true,cancel:true},
  {service:2,name:'Views',type:'Default',category:'Videos',rate:'0.0025',min:100,max:100000,refill:0,cancel:1},
];
test('retains exact supplier decimal rate; never invents NZD retail pricing',()=>{
 const result=normalizeSupplierList(example);
 assert.equal(result.listed,2);
 assert.deepEqual(result.services.map(s=>s.rate),['0.90','0.0025']);
 assert.equal(result.currency,'UNVERIFIED');
 assert.equal(result.services[0].refill,true);
 assert.equal(result.services[1].cancel,true);
 assert.equal(result.services[0].min,50);
 assert.equal('retail_price' in result.services[0],false);
});
test('invalid IDs, quantities, rates and duplicate IDs are ignored',()=>{
 const result=normalizeSupplierList([...example,{...example[0]},{service:3,name:'fake',rate:'-1',min:1,max:4},{service:4,name:'fake',rate:'0.9',min:200,max:4},{service:'1 OR 1=1',name:'fake',rate:1,min:1,max:100}]);
 assert.equal(result.valid,2);
 assert.equal(result.rejected,4);
});
test('output is trimmed, capped and rejects invalid service-list response',()=>{
 assert.throws(()=>normalizeSupplierList({error:'Bad key'}));
 const result=normalizeSupplierList(Array.from({length:500},(_,id)=>({service:id+1,name:'Title',rate:'1.5',min:1,max:5000})),15);
 assert.equal(result.services.length,15);
 assert.equal(result.truncated,true);
 assert.equal(result.listed,500);
});
test('balance readout preserves stated currency without converting',()=>{
 assert.deepEqual(normalizeSupplierBalance({balance:'100.84292',currency:'USD'}),{balance:'100.84292',currency:'USD'});
 assert.throws(()=>normalizeSupplierBalance({balance:'-100',currency:'USD'}));
});
test('supplier key never appears in public config and function does not allow supplier orders',()=>{
 const config=readFileSync(new URL('../config.js',import.meta.url),'utf8');
 const edge=readFileSync(new URL('../supabase/functions/smmfollows-preview/index.ts',import.meta.url),'utf8');
 assert.doesNotMatch(config,/SMMFOLLOWS_API_KEY|smmfollows\.com\/api\/v2/);
 assert.match(edge,/action !== 'services' && action !== 'balance'/);
 assert.match(edge,/adminRows\[0\]\?\.user_id !== user\.id/);
 assert.doesNotMatch(edge, /action:\s*'add'/);
 assert.match(edge,/SMMFOLLOWS_API_KEY/);
});
