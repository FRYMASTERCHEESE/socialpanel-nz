import test from 'node:test';
import assert from 'node:assert/strict';
import {filterSupplierServices,searchTextForService,englishServiceHint} from '../search.mjs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHandler} from '../server.mjs';

const sample=[
 {service:772,category:'فيسبوك [تعمل بعد آخر تحديث]',name:'متابعون فيسبوك [تقبل جميع الاشكال] [إعادة تعبئة 30 يوم]',rate:'14.89'},
 {service:1737,category:'فيسبوك',name:'متابعون فيسبوك [5 ك لليوم] [بدون إعادة تعبئة]',rate:'12.50'},
 {service:1734,category:'فيسبوك',name:'متابعين فيسبوك [سريع]',rate:'23.92'},
 {service:773,category:'فيسبوك',name:'اعجابات صفحه فيسبوك',rate:'24.60'},
 {service:820,category:'أعضاء جروب فيسبوك',name:'اعضاء جروب فيسبوك',rate:'50.05'},
 {service:993,category:'خدمات يوتيوب',name:'مشتركون يوتيوب [200-500 لليوم]',rate:'2491.87'},
 {service:990,category:'خدمات يوتيوب',name:'مشاهدات يوتيوب',rate:'59.54'},
 {service:744,category:'تيك توك',name:'مشاهدات تيك توك',rate:'4.32'},
 {service:3333,category:'Instagram',name:'Instagram followers',rate:'2.50'},
];

test('English Facebook followers query matches Arabic follower listings but not likes, group members or YouTube',()=>{
 const matched=filterSupplierServices(sample,'Facebook followers');
 assert.deepEqual(matched.map(s=>s.service),[772,1737,1734]);
 assert.ok(matched.every(s=>s.rate && typeof s.rate==='string'));
});
test('Arabic and English spelling variations return corresponding service rows',()=>{
 assert.deepEqual(filterSupplierServices(sample,'متابعين فيسبوك').map(s=>s.service),[1734]);
 assert.deepEqual(filterSupplierServices(sample,'فيسبوك').map(s=>s.service),[772,1737,1734,773,820]);
 assert.deepEqual(filterSupplierServices(sample,'facebook likes').map(s=>s.service),[773]);
 assert.deepEqual(filterSupplierServices(sample,'youtube subscribers').map(s=>s.service),[993]);
 assert.deepEqual(filterSupplierServices(sample,'youtube views').map(s=>s.service),[990]);
 assert.deepEqual(filterSupplierServices(sample,'tiktok views').map(s=>s.service),[744]);
 assert.deepEqual(filterSupplierServices(sample,'instagram followers').map(s=>s.service),[3333]);
});
test('Search is case insensitive, accent/whitespace tolerant and supports service IDs',()=>{
 assert.equal(filterSupplierServices(sample,'  FACEBOOK   FOLLOWERS  ').length,3);
 assert.deepEqual(filterSupplierServices(sample,'1737').map(s=>s.service),[1737]);
 assert.equal(filterSupplierServices(sample,' ').length,sample.length);
 assert.equal(filterSupplierServices(sample,'gibberish').length,0);
});
test('Bilingual search preserves prices and does not mutate supplier catalogue',()=>{
 const before=JSON.stringify(sample);
 const results=filterSupplierServices(sample,'facebook followers');
 assert.equal(results[1].rate,'12.50');
 assert.equal(JSON.stringify(sample),before);
 assert.equal(englishServiceHint(sample[0]),'Facebook · followers');
 assert.equal(englishServiceHint(sample[5]),'Youtube · subscribers');
 assert.ok(searchTextForService(sample[0]).includes('facebook'));
});
test('Backend serves search helper locally without third-party scripts',async()=>{
 const srv=createServer(createHandler({env:{}}));
 srv.listen(0,'127.0.0.1');await once(srv,'listening');
 const url='http://127.0.0.1:'+srv.address().port;
 try {
   const r=await fetch(url+'/admin/search.mjs');
   assert.equal(r.status,200);
   assert.match(await r.text(),/filterSupplierServices/);
   const html=await(await fetch(url+'/admin')).text();
   assert.match(html,/type="module"/);
   assert.match(html,/search-help/);
 }finally{await new Promise(resolve=>srv.close(resolve));}
});
