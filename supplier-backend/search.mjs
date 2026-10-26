/**
 * Client-side search aliases for private, unmodified supplier catalogue rows.
 * Alhitaan commonly supplies Arabic descriptions; the helper only enriches
 * searching and labels. It NEVER changes API rates or fulfilment data.
 */
function fold(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .toLocaleLowerCase('en')
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
const TERMS = Object.freeze([
  ['facebook', ['facebook', 'فيسبوك', 'فيس بوك', 'فيسبوک']],
  ['instagram', ['instagram', 'انستغرام', 'انستجرام', 'انستقرام']],
  ['youtube', ['youtube', 'يوتوب', 'يوتيوب']],
  ['tiktok', ['tiktok', 'tik tok', 'تيكتوك', 'تيك توك']],
  ['telegram', ['telegram', 'تلجرام', 'تليجرام', 'تيليجرام']],
  ['followers', ['followers', 'follower', 'متابع', 'متابعون', 'متابعين', 'فولورز']],
  ['subscribers', ['subscribers', 'subscriber', 'مشترك', 'مشتركون', 'مشتركين', 'اشتراك']],
  ['views', ['views', 'view', 'مشاهد', 'مشاهدات', 'مشاهده']],
  ['likes', ['likes', 'like', 'لايك', 'اعجاب', 'اعجابات']],
  ['shares', ['shares', 'share', 'مشارك', 'مشاركات']],
  ['comments', ['comments', 'comment', 'تعليق', 'تعليقات']],
  ['group', ['group', 'جروب', 'مجموعه']],
  ['page', ['page', 'صفحه', 'بيج']],
  ['reactions', ['reaction', 'reactions', 'تفاعل', 'ريأكت', 'رياكت']],
  ['story', ['story', 'stories', 'ستوري', 'قصه']],
  ['live', ['live', 'بث مباشر', 'مباشر']],
]);
const ALIASES = TERMS.map(([english,words])=>[english,words.map(fold)]);
export function searchTextForService(item) {
  const raw=fold([item.service,item.category,item.name,item.type].join(' '));
  const aliases=ALIASES.filter(([,words])=>words.some(w=>w && raw.includes(w))).map(([english])=>english);
  return (raw + ' ' + aliases.join(' ')).trim();
}
export function filterSupplierServices(rows,query) {
  const terms=fold(query).split(' ').filter(Boolean);
  if(!terms.length)return [...rows];
  return rows.filter(item=>{
    const content=searchTextForService(item);
    return terms.every(term=>content.includes(term));
  });
}
export function englishServiceHint(item) {
  const terms=new Set(searchTextForService(item).split(' '));
  const platform=['facebook','youtube','instagram','tiktok','telegram'].find(x=>terms.has(x));
  const type=['followers','subscribers','views','likes','shares','comments','reactions','group','story','live'].find(x=>terms.has(x));
  return platform&&type ? platform[0].toUpperCase()+platform.slice(1)+' · '+type : '';
}
