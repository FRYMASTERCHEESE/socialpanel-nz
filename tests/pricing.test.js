import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {perThousandCents,serviceTotalCents} from '../js/utils.js';
import {DEMO_SERVICES} from '../js/catalog.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('per-1,000 quotes are rounded up to valid integer cents',()=>{
  assert.equal(perThousandCents(9,1000,100,100000),9);
  assert.equal(perThousandCents(9,2500,100,100000),23);
  assert.equal(perThousandCents(9,100,100,100000),1);
  assert.equal(perThousandCents(94,1500,50,30000),141);
});
test('unsafe quantities and rates cannot generate demo quotes',()=>{
  for(const q of [0,99,100001,1.5,NaN,Infinity]) assert.throws(()=>perThousandCents(9,q,100,100000));
  for(const p of [0,-2,NaN,Infinity,4.5]) assert.throws(()=>perThousandCents(p,1000));
  assert.throws(()=>perThousandCents(9,100,500,100));
});
test('service total honours displayed rate and service limits',()=>{
  const cheap=DEMO_SERVICES.find(s=>s.code==='21001');
  assert.equal(serviceTotalCents(cheap,2500),23);
  assert.throws(()=>serviceTotalCents(cheap,10));
  assert.equal(serviceTotalCents({price_cents:1500,min_quantity:1,max_quantity:200,price_unit:'per_package'},2),3000);
});
test('demo catalogue is unmistakably inactive and has unique numbered services',()=>{
  assert.ok(DEMO_SERVICES.length>=30);
  assert.equal(new Set(DEMO_SERVICES.map(s=>s.code)).size,DEMO_SERVICES.length);
  assert.ok(DEMO_SERVICES.every(s=>s.price_unit==='per_1000' && s.min_quantity>0 && s.max_quantity>=s.min_quantity && !s.is_active));
  assert.ok(Math.min(...DEMO_SERVICES.map(s=>s.price_cents))<100);
});
test('server-side purchase is disabled until an explicit backend approval',()=>{
  assert.match(read('config.js'),/ordersEnabled:\s*false/);
  const sql=read('supabase/schema.sql');
  assert.match(sql,/order_intake_enabled boolean not null default false/);
  assert.match(sql,/order_intake_enabled from app_private\.panel_controls/);
  assert.match(sql,/price_unit='per_1000'/);
  assert.match(sql,/enable row level security/);
});
