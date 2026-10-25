# SocialPanel NZ — isolated Render supplier preview

This tiny Node.js 22+ service runs separately on Render Free, using **only** the `FRYMASTERCHEESE/socialpanel-nz` repository. It is a read-only, owner-authenticated viewer for the SMMFollows supplier `POST https://smmfollows.com/api/v2` API.

## Live endpoints

- `GET /healthz` — public status; reports readOnly=true and ordersEnabled=false. No secrets.
- `GET /admin` — private-price viewer; requires the owner access token to actually request data.
- `POST /api/preview` — owner-token-protected and accepts **only** `{ "action": "services" }` or `{ "action": "balance" }`.
- There is **no** order placement, refill, cancel, refund, payment, balance top-up, customer checkout or public retail price import endpoint.

## On Render (separate Free web service)

- Source: `https://github.com/FRYMASTERCHEESE/socialpanel-nz`
- Plan: **Free**; region: Singapore; runtime: Node.
- Build command: `node --version` (no dependencies required).
- Start command: `node supplier-backend/server.mjs`
- Private Render **Environment** settings — you must enter both values yourself:
  - `SMMFOLLOWS_API_KEY`: your own SMMFollows Account API key; **never** post this in a chat, repo or browser code.
  - `SOCIALPANEL_OWNER_TOKEN`: a separate random password/token of **at least 24 characters** from a password manager. Keep it private. This is NOT the supplier key. You enter it into `/admin` on each page load.
- Save/deploy after setting both. Without them, supplier API routes return HTTP 503 (fail-closed).
- No values for either variable are hardcoded in GitHub or in the static website.

The private `/admin` form retains the owner token only in the open page input: no localStorage, cookies, third-party JS or browser-sync. It sends the owner token only over HTTPS to its own Render service as an authorization header. For privacy, don't share screenshots of the token, store it in your password manager, and rotate it if exposed.

**Supplier service pricing is not retail NZD pricing**: the services response labels its currency **UNVERIFIED**. Verify the supplier's actual currency, fulfilment quality and compliance before setting retail prices or accepting orders. API access does not establish direct supplier status.

## Operational notes

- The free web service sleeps after 15 minutes of inactivity and can take ~1 minute to wake.
- Free usage is **shared across the entire Render workspace**, and Render can suspend services after quota exhaustion. The Free plan is for preview/testing, not production order fulfilment.
- Backend outgoing requests have a timeout and size limits. Owner requests are rate-limited in memory.
- All supplier requests use a fixed endpoint; client input cannot supply provider URL, supplier key, order action, or price.
- Public health checks show no secrets, and error messages are deliberately sanitized.

## Test

```bash
node --test supplier-backend/tests/*.test.mjs
node --check supplier-backend/server.mjs
node --check supplier-backend/admin.js
```

Tests use synthetic upstream responses and do not call SMMFollows or place orders.

## Catalogue inspection (owner-only)

The owner viewer fetches up to 5,000 valid unique SMMFollows services at a time, filters the loaded list, and paginates in groups of 75 to keep mobile devices responsive. Use **Cheapest first** to compare supplier rates per 1,000 **within the supplier's unverified currency**. Diagnostic counts distinguish duplicate IDs, invalid rates, invalid quantities and malformed entries. No rejected supplier data or credentials are displayed. The browser does not persist the supplier catalogue or owner token. If the provider returns over 5,000 valid services, the viewer marks the list truncated; this limit is intentional, not a supplier guarantee.
