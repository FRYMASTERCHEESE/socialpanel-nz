import test from 'node:test';
import assert from 'node:assert/strict';
import {escapeHtml,currency,safeUrl,totalCents,shortId,formatDate} from '../js/utils.js';
import {PLATFORMS,DEMO_SERVICES,platformFor} from '../js/catalog.js';

test('escapeHtml prevents markup and script tag rendering',()=>{
 assert.equal(escapeHtml(`<script src="x">'&`),'&lt;script src=&quot;x&quot;&gt;&#39;&amp;');
 assert.equal(escapeHtml(null),'');
});
test('prices use cents and NZD defaults',()=>{
 assert.match(currency(3990),/39\.90/);
 assert.match(currency(0),/0\.00/);
});
test('url validation rejects dangerous schemes and invalid hosts',()=>{
 assert.equal(safeUrl('javascript:alert(1)'),null);
 assert.equal(safeUrl('data:text/html,hi'),null);
 assert.equal(safeUrl('https://localhost'),null);
 assert.equal(safeUrl('not a link'),null);
 assert.equal(safeUrl('https://example.com/watch?v=1'),'https://example.com/watch?v=1');
 assert.equal(safeUrl('https://example.com/'+ 'x'.repeat(2100)),null);
});
test('order total is calculated in integer cents, with bounds',()=>{
 assert.equal(totalCents(3900,3),11700);
 assert.throws(()=>totalCents(3900,0));
 assert.throws(()=>totalCents(3900,101));
 assert.throws(()=>totalCents(NaN,1));
 assert.throws(()=>totalCents(-100,1));
 assert.throws(()=>totalCents(100,1.5));
});
test('catalogue includes separate platform categories and unique SKUs',()=>{
 assert.ok(PLATFORMS.length >= 16);
 assert.equal(new Set(DEMO_SERVICES.map(s=>s.code)).size,DEMO_SERVICES.length);
 assert.ok(DEMO_SERVICES.every(s=>s.price_cents>0));
 assert.ok(DEMO_SERVICES.every(s=>PLATFORMS.some(p=>p.id===s.platform)));
 assert.equal(platformFor('youtube').name,'YouTube');
 assert.equal(platformFor('nonexistent').name,'Other services');
});
test('date and order ids are formatted safely',()=>{
 assert.equal(shortId('abcdefghijk'),'ABCDEFGH');
 assert.equal(formatDate('invalid'),'—');
});
