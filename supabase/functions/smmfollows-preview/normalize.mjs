/**
 * Pure normalisation of an untrusted SMMFollows API service-list response.
 * All rates remain in the supplier's own, UNVERIFIED currency; no retail price is set.
 * Never import these records into the public storefront without review.
 */
function asPositiveInteger(value, max = 10_000_000) {
  const text = String(value ?? '').trim();
  if (!/^[0-9]{1,12}$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= 1 && n <= max ? n : null;
}
function cleanText(value, maximum) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
}
function rateText(value) {
  const text = String(value ?? '').trim();
  if (!/^(?:\d{1,10})(?:\.\d{1,8})?$/.test(text)) return null;
  const num = Number(text);
  return Number.isFinite(num) && num > 0 && num <= 100_000_000 ? text : null;
}
function flag(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}
export function normalizeSupplierList(payload, limit = 300) {
  if (!Array.isArray(payload)) throw Error('Supplier returned an invalid service list');
  if (payload.length > 100_000) throw Error('Supplier returned too many services');
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, 1000)) : 300;
  const result = [];
  const seen = new Set();
  let rejected = 0;
  for (const raw of payload) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { rejected++; continue; }
    const id = asPositiveInteger(raw.service, 2_147_483_647);
    const name = cleanText(raw.name, 160);
    const category = cleanText(raw.category, 100);
    const type = cleanText(raw.type, 80);
    const rate = rateText(raw.rate);
    const min = asPositiveInteger(raw.min);
    const max = asPositiveInteger(raw.max);
    if (!id || !name || !rate || !min || !max || max < min || seen.has(id)) { rejected++; continue; }
    seen.add(id);
    if (result.length < safeLimit) {
      result.push({service:id,name,category,type,rate,min,max,refill:flag(raw.refill),cancel:flag(raw.cancel)});
    }
  }
  return {services:result,listed:payload.length,valid:seen.size,rejected,truncated:seen.size>result.length,
    currency:'UNVERIFIED',note:'Rates are per 1,000 in the supplier currency; verify live currency, prices, eligibility and TOS. No services imported or published.'};
}
export function normalizeSupplierBalance(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.error) throw Error('Supplier balance was unavailable');
  const balance = String(payload.balance ?? '').trim();
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(balance)) throw Error('Supplier balance was invalid');
  const currency = cleanText(payload.currency || 'UNVERIFIED', 16).toUpperCase();
  if (!/^[A-Z]{3,16}$/.test(currency)) throw Error('Supplier currency was invalid');
  return {balance,currency};
}
