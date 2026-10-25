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
  // An owner preview may inspect up to 5,000 vetted rows. Pagination happens in the browser.
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, 5000)) : 300;
  const services = [];
  const seen = new Set();
  // Only counts are returned. Never echo untrusted supplier rows that fail validation.
  const rejectedReasons = {invalidRecord:0, invalidId:0, missingName:0, invalidRate:0, invalidQuantityRange:0, duplicateId:0};
  for (const raw of payload) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { rejectedReasons.invalidRecord++; continue; }
    const id = asPositiveInteger(raw.service, 2_147_483_647);
    const name = cleanText(raw.name, 160);
    const category = cleanText(raw.category, 100);
    const type = cleanText(raw.type, 80);
    const rate = rateText(raw.rate);
    const min = asPositiveInteger(raw.min);
    const max = asPositiveInteger(raw.max);
    if (!id) { rejectedReasons.invalidId++; continue; }
    if (!name) { rejectedReasons.missingName++; continue; }
    if (!rate) { rejectedReasons.invalidRate++; continue; }
    if (!min || !max || max < min) { rejectedReasons.invalidQuantityRange++; continue; }
    if (seen.has(id)) { rejectedReasons.duplicateId++; continue; }
    seen.add(id);
    if (services.length < safeLimit) {
      services.push({service:id,name,category,type,rate,min,max,refill:flag(raw.refill),cancel:flag(raw.cancel)});
    }
  }
  const rejected = Object.values(rejectedReasons).reduce((n, count) => n + count, 0);
  return {services, listed:payload.length, valid:seen.size, rejected, rejectedReasons,
    truncated:seen.size>services.length,
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
