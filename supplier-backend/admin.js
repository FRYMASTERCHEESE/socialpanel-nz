'use strict';
// All credentials remain in the current page's input element. No localStorage/cookies.
const el = (id) => document.getElementById(id);
const input = el('token');
const message = el('message');
let services = [];
function status(text, kind = '') { message.textContent = text; message.className = 'message ' + kind; }
function clearRows() { el('rows').replaceChildren(); el('balance-result').hidden = true; el('table-region').hidden = true; el('search-label').hidden = true; }
function cell(row, text) { const td = document.createElement('td'); td.textContent = String(text ?? ''); row.appendChild(td); }
function renderRows(list) {
  const body = el('rows'); body.replaceChildren();
  const frag = document.createDocumentFragment();
  for (const item of list.slice(0, 300)) {
    const tr = document.createElement('tr');
    cell(tr, item.service); cell(tr, item.category); cell(tr, item.name); cell(tr, item.rate);
    cell(tr, item.min); cell(tr, item.max); cell(tr, item.refill ? 'Yes' : 'Not confirmed');
    frag.appendChild(tr);
  }
  body.appendChild(frag);
}
el('filter').addEventListener('input', () => {
  const value = el('filter').value.toLocaleLowerCase();
  renderRows(services.filter(s => [s.service, s.name, s.category, s.type].some(t => String(t).toLowerCase().includes(value))));
});
el('toggle-token').addEventListener('click', () => {
  const shown = input.type === 'text'; input.type = shown ? 'password' : 'text';
  el('toggle-token').textContent = shown ? 'Show' : 'Hide';
});
el('clear').addEventListener('click', () => {
  input.value = ''; services = []; clearRows(); el('results').hidden = true;
  status('Cleared. Access token was not stored on this device.');
});
async function check(action) {
  if (input.value.trim().length < 24) { status('Enter the owner token you set in Render (at least 24 characters).', 'error'); input.focus(); return; }
  const clicked = el(action); clicked.disabled = true;
  el('services').disabled = true; el('balance').disabled = true;
  status('Checking supplier ' + action + ' securely…');
  try {
    const response = await fetch('/api/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + input.value.trim() },
      body: JSON.stringify({ action }), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Connection was unsuccessful');
    if (data.readOnly !== true || data.provider !== 'SMMFollows') throw new Error('Unexpected response');
    clearRows(); el('results').hidden = false;
    if (action === 'services') {
      services = Array.isArray(data.services) ? data.services : [];
      el('result-heading').textContent = 'Supplier services (' + services.length + ' shown)';
      el('result-note').textContent = 'Supplier rates per 1,000. Currency UNVERIFIED — these are private supplier quotes, not customer selling prices. ' + (data.truncated ? 'Only the first 300 valid services are displayed. ' : '') + (data.rejected ? data.rejected + ' invalid/duplicate rows excluded.' : '');
      el('search-label').hidden = false; el('filter').value = ''; el('table-region').hidden = false;
      renderRows(services);
      status('Retrieved a read-only supplier list. Nothing was ordered, charged, or published.', 'success');
    } else {
      services = [];
      el('result-heading').textContent = 'Supplier account balance';
      el('result-note').textContent = 'Balance and currency are reported by the supplier. This is not SocialPanel NZ customer funds.';
      const balance = el('balance-result'); balance.textContent = String(data.balance) + ' ' + String(data.currency);
      balance.hidden = false;
      status('Retrieved supplier balance without any charge or order.', 'success');
    }
  } catch (e) { status(e instanceof Error ? e.message : 'The supplier check failed.', 'error'); }
  finally { clicked.disabled = false; el('services').disabled = false; el('balance').disabled = false; }
}
el('services').addEventListener('click', () => check('services'));
el('balance').addEventListener('click', () => check('balance'));
