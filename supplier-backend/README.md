# SocialPanel NZ — isolated Render supplier preview

This tiny Node.js 22+ service runs separately on Render Free, using **only** the `FRYMASTERCHEESE/socialpanel-nz` repository. It is a read-only, owner-authenticated viewer for SMMFollows, SMMLite, DaoSMM and Likeo reseller catalogue and balance APIs.

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

## SMMLite supplier (read-only, requires a NEW private key)

SMMLite advertises API access, but its exact authenticated API endpoint has not yet been independently confirmed. The backend uses the common SMM-panel v2 path `https://smmlite.com/api/v2` as a provisional fixed server-side URL. Check the official logged-in API documentation before relying on results.

1. **Revoke/regenerate the SMMLite key previously pasted into chat**. Do not reuse or resend that key.
2. On the existing Render service named `socialpanel-nz-supplier`, open **Environment** and add `SMMLITE_API_KEY` with the NEW key as a private value. Preserve `SMMFOLLOWS_API_KEY` and `SOCIALPANEL_OWNER_TOKEN`. Never place supplier keys in the public website, in commits, or in chat.
3. Save and deploy. At `/admin`, enter your existing owner token, select SMMLite, and check the supplier balance and service list. Missing SMMLite credentials cause only SMMLite to fail closed; SMMFollows remains connected.
4. Confirm live API endpoint, currency, minimum quantities, quality and service terms before making any pricing decisions. Website sales and automated orders remain disabled.

The backend supports exactly two suppliers and only `services`/`balance` actions. There is no supplier `add`, refills, cancellations, customer payments, public wholesale disclosure or order fulfilment action. SMM-panel catalogue rates for different services must not be assumed equivalent.

## DaoSMM supplier (third provider, read-only)

DaoSMM's official code example at https://daosmm.com/example.txt documents
`POST https://daosmm.com/api/v2` using form fields `key` and `action`.
This integration permits only `services` and `balance`, not `add`, `status`,
`refill`, `cancel`, funds, orders or imports.

1. In the existing **SocialPanel NZ supplier** Render service, open **Environment**.
2. Add the secret `DAOSMM_API_KEY` using the DaoSMM API key from your own account.
   **Never** put the key in chat, your public GitHub repository, browser JavaScript or website config.
   Leave existing `SMMLITE_API_KEY`, `SMMFOLLOWS_API_KEY` and `SOCIALPANEL_OWNER_TOKEN` unchanged.
3. Save and deploy, then open the existing `/admin` viewer, choose **DaoSMM**,
   enter the **same** owner token, check **supplier balance** (including currency),
   then check **supplier services**. The new provider fails closed until configured.
4. Inspect actual DaoSMM service IDs, limits, quality claims and currency before comparing
   rates, importing or publishing anything. Real order placement remains disabled.
   Currency for `services` responses remains **UNVERIFIED** until the balance endpoint confirms it.

**Price clarity:** DaoSMM #8719 showed a $30.00 charge at quantity 10,000 and a
10,000 maximum per order in the provided screenshot (equivalent to $3.00/1,000 in its
displayed currency). It is not a US$0.0044-per-1,000 offer. A 100,000 quantity would
require multiple separate orders *if permitted*, and none has been placed.


## Likeo API as fourth supplier — read-only

The official Likeo documentation at https://likeo.net/api confirms
`POST https://likeo.net/api/v2` with form-encoded `key` and
`action=services` or `action=balance`. This app does NOT implement
the supplier's order, refill, cancellation or payment API actions.

1. Open **SocialPanel NZ supplier** service in Render → **Environment**.
2. Add secret `LIKEO_API_KEY` with your private Likeo API key. Do not put the
   key in GitHub, any public website, or this conversation. Keep the existing
   supplier keys and `SOCIALPANEL_OWNER_TOKEN` untouched.
3. Save and deploy the Render service. Open its private `/admin` page,
   select **Likeo**, use the existing owner token, then **Check supplier balance**
   (for currency) and **Check supplier services** (for actual service prices).

The key is used only server-side; without it Likeo fails closed.
No services are published, and no money is spent. Displayed supplier
prices remain private and the website's public rates remain demonstration-only.
