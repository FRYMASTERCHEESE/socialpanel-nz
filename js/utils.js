export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function currency(cents, code='NZD') {
  const safe=Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return new Intl.NumberFormat('en-NZ',{style:'currency',currency:code}).format(safe / 100);
}
export function formatDate(iso) {
  if (!iso || isNaN(new Date(iso).getTime())) return '—';
  return new Intl.DateTimeFormat('en-NZ',{day:'numeric',month:'short',year:'numeric'}).format(new Date(iso));
}
export function safeUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') && u.href.length <= 2000 ? u.href : null;
  } catch { return null; }
}
export function totalCents(unitPriceCents, quantity) {
  const p=Number(unitPriceCents), q=Number(quantity);
  if (!Number.isSafeInteger(p) || p < 0 || !Number.isSafeInteger(q) || q < 1 || q > 100) throw Error('Invalid order amount');
  const total=p*q;
  if (!Number.isSafeInteger(total)) throw Error('Order amount is too large');
  return total;
}
export function readLocal(key,fallback) {
  try { const val=JSON.parse(localStorage.getItem('spnz-'+key));return val ?? fallback; } catch{return fallback;}
}
export function writeLocal(key,value) {
  try {localStorage.setItem('spnz-'+key,JSON.stringify(value));return true;}catch{return false;}
}
export function shortId(id) { return String(id||'').slice(0,8).toUpperCase(); }

// Untrusted, browser-only preview identifier. Never used for payment security.
export function demoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `demo-${crypto.randomUUID()}`;
  const arr=new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(arr);
  else for(let i=0;i<arr.length;i++) arr[i]=Math.floor(Math.random()*256);
  return 'demo-'+Date.now().toString(36)+'-'+Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');
}
