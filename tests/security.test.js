import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('preview config uses no active Supabase backend or secrets',()=>{
 const c=read('config.js');
 assert.match(c,/supabaseUrl: ''/);
 assert.match(c,/supabasePublishableKey: ''/);
 assert.doesNotMatch(c,/(sb_secret_[a-zA-Z0-9]+|service_role\s*:\s*['\"][^'\"]+)/);
});
test('all sensitive tables enforce RLS',()=>{
 const sql=read('supabase/schema.sql');
 for(const table of ['profiles','app_admins','wallets','wallet_ledger','services','orders','tickets']){
  assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
 }
 assert.match(sql,/wallets set balance_cents=balance_cents-v_total/);
 assert.match(sql,/select balance_cents into v_available.+for update/);
 assert.match(sql,/unique/);
 assert.match(sql,/app_private\.is_admin\(\)/);
});
test('site includes meaningful transparent privacy and terms documents',()=>{
 assert.match(read('privacy.html'),/local storage/i);
 assert.match(read('terms.html'),/preview order/i);
});
