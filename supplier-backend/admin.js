import {filterSupplierServices, englishServiceHint} from './search.mjs';
'use strict';
// All credentials remain in the current page's input element. No localStorage/cookies.
const el = (id) => document.getElementById(id);
const input = el('token');
const message = el('message');
const provider = el('provider');
const SUPPLIER_NAMES = Object.freeze({smmfollows:'SMMFollows',smmlite:'SMMLite',daosmm:'DaoSMM',likeo:'Likeo',alhitaan:'Alhitaan',smmasia:'SMMASIA'});
const supplierLabel = () => SUPPLIER_NAMES[provider.value] || 'Unknown supplier';
let services = [];
let currentPage = 0;
const pageSize = 75;
function status(text, kind = '') { message.textContent = text; message.className = 'message ' + kind; }
function clearRows() {
  el('rows').replaceChildren();
  for (const id of ['balance-result','table-region','search-label','search-help','service-controls','pager']) el(id).hidden = true;
}
function cell(row, text) { const td = document.createElement('td'); td.textContent = String(text ?? ''); row.appendChild(td); }
function filteredServices() {
  const value = el('filter').value.toLocaleLowerCase().trim();
  const items = provider.value === 'alhitaan' ? filterSupplierServices(services,value) :
    services.filter(s => [s.service,s.name,s.category,s.type].some(t => String(t).toLocaleLowerCase().includes(value)));
  const sort = el('sort-services').value;
  if (sort === 'cheapest') items.sort((a,b) => Number(a.rate)-Number(b.rate) || a.service-b.service);
  if (sort === 'expensive') items.sort((a,b) => Number(b.rate)-Number(a.rate) || a.service-b.service);
  if (sort === 'name') items.sort((a,b) => a.name.localeCompare(b.name) || a.service-b.service);
  return items;
}
function renderRows() {
  const matches = filteredServices();
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  currentPage = Math.max(0, Math.min(currentPage, pages - 1));
  const body = el('rows'); body.replaceChildren();
  const frag = document.createDocumentFragment();
  const start = currentPage * pageSize;
  for (const item of matches.slice(start, start + pageSize)) {
    const tr = document.createElement('tr');
    cell(tr, item.service); cell(tr, item.category); cell(tr, item.name); cell(tr, item.rate);
    if(provider.value === 'alhitaan') {
      const hint=englishServiceHint(item);
      if(hint){const note=document.createElement('small');note.className='language-hint';note.textContent=hint+' (search label)';tr.children[2].appendChild(note);}
    }
    cell(tr, item.min); cell(tr, item.max); cell(tr, item.refill ? 'Yes' : 'Not confirmed');
    frag.appendChild(tr);
  }
  body.appendChild(frag);
  el('pager').hidden = false;
  el('page-status').textContent = matches.length ?
    `Showing ${start+1}–${Math.min(start+pageSize,matches.length)} of ${matches.length} matching services (page ${currentPage+1} of ${pages})` :
    'No services match your search';
  el('prev-page').disabled = currentPage === 0;
  el('next-page').disabled = currentPage >= pages - 1;
}
provider.addEventListener('change', () => { services = []; currentPage = 0; clearRows(); el('results').hidden = true; status(`${supplierLabel()} selected. Nothing will be ordered.`); });
el('filter').addEventListener('input', () => { currentPage = 0; renderRows(); });
el('sort-services').addEventListener('change', () => { currentPage = 0; renderRows(); });
el('prev-page').addEventListener('click', () => { currentPage--; renderRows(); });
el('next-page').addEventListener('click', () => { currentPage++; renderRows(); });
el('toggle-token').addEventListener('click', () => {
  const shown = input.type === 'text'; input.type = shown ? 'password' : 'text';
  el('toggle-token').textContent = shown ? 'Show' : 'Hide';
});
el('clear').addEventListener('click', () => {
  input.value = ''; services = []; currentPage = 0; clearRows(); el('results').hidden = true;
  status('Cleared. Access token was not stored on this device.');
});
async function check(action) {
  if (input.value.trim().length < 24) { status('Enter the owner token you set in Render (at least 24 characters).', 'error'); input.focus(); return; }
  const clicked = el(action); clicked.disabled = true;
  el('services').disabled = true; el('balance').disabled = true; provider.disabled = true;
  const selectedProvider = provider.value;
  status(`Checking ${supplierLabel()} ${action} securely…`);
  try {
    const response = await fetch('/api/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + input.value.trim() },
      body: JSON.stringify({ action, provider: selectedProvider }), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Connection was unsuccessful');
    if (data.readOnly !== true || data.provider !== SUPPLIER_NAMES[selectedProvider]) throw new Error('Unexpected response');
    clearRows(); el('results').hidden = false;
    if (action === 'services') {
      services = Array.isArray(data.services) ? data.services : [];
      el('result-heading').textContent = `${data.provider} services (${services.length.toLocaleString()} loaded)`;
      const counts = data.rejectedReasons || {};
      const reasons = [
        ['duplicateId','duplicate IDs'],['invalidQuantityRange','invalid quantity limits'],
        ['invalidRate','invalid rates'],['invalidId','invalid IDs'],
        ['missingName','missing names'],['invalidRecord','other invalid records']
      ].filter(([key]) => Number(counts[key]) > 0).map(([key,label]) => `${counts[key]} ${label}`).join(', ');
      el('result-note').textContent = `${data.provider} rates per 1,000 in UNVERIFIED currency — private quotes, not customer prices. ` +
        `${data.valid} valid unique services in ${data.listed} supplier rows. ` +
        (data.truncated ? `Only the first ${services.length} valid entries were loaded. ` : '') +
        (data.rejected ? `${data.rejected} rows excluded${reasons ? ' ('+reasons+')' : ''}. ` : '') +
        'Check terms and verify currency before using any rate. Nothing is published.';
      el('search-label').hidden = false; el('filter').value = ''; el('table-region').hidden = false;
      el('search-help').hidden = selectedProvider !== 'alhitaan';
      el('service-controls').hidden = false; el('sort-services').value = 'supplier';
      currentPage = 0; renderRows();
      status('Retrieved a read-only supplier list. Nothing was ordered, charged, or published.', 'success');
    } else {
      services = [];
      el('result-heading').textContent = `${data.provider} account balance`;
      el('result-note').textContent = 'Balance and currency are reported by the supplier. This is not SocialPanel NZ customer funds.';
      const balance = el('balance-result'); balance.textContent = String(data.balance) + ' ' + String(data.currency);
      balance.hidden = false;
      status('Retrieved supplier balance without any charge or order.', 'success');
    }
  } catch (e) { status(e instanceof Error ? e.message : 'The supplier check failed.', 'error'); }
  finally { clicked.disabled = false; el('services').disabled = false; el('balance').disabled = false; provider.disabled = false; }
}
el('services').addEventListener('click', () => check('services'));
el('balance').addEventListener('click', () => check('balance'));
