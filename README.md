# SocialPanel NZ

A **completely separate**, mobile-first SMM dashboard built for **GitHub Pages**. Includes an interactive catalogue inspired by familiar SMM-panel layouts, without reusing or touching an existing website.

**Current build: safe preview + optional secure database foundation.** The site is **not a live payment or service-delivery operation**. All catalogue prices and turnaround times in preview mode are fictional examples. Do not accept customer funds or claim delivery until a genuine provider, business details, legal terms, payment processor and fulfilment process are verified.

## Included

- Responsive dashboard, account spending and balance cards
- 18 social platform tiles, searchable and sortable services, favourites, featured items
- Preview order form with URL validation and estimated cost; stores preview orders only in the current browser
- Order history, local demo support tickets, wallet explanation, light/dark mode
- Draft privacy and terms pages
- Optional **Supabase** customer authentication, private orders and tickets, wallet ledger, owner-only admin catalogue, owner-only manual balance credits
- Strict database RLS, a locked/transactional order RPC, idempotent wallet-credit references and refunds on cancellation
- No ads or analytics trackers, no card collection, no external supplier/API fulfilment
- Plain HTML/CSS/JavaScript; no npm build step, no paid hosting required for static preview

## Publish a completely new GitHub Pages website

1. Open **[github.com/new](https://github.com/new?name=socialpanel-nz&description=Independent%20social%20marketing%20panel)** while logged in to **FRYMASTERCHEESE**.
2. Repository name: `socialpanel-nz`; choose **Public**. Do not select an existing repository. Optionally initialise with a README.
3. Extract the supplied `socialpanel-nz.zip`. In the NEW repo, select **Add file → Upload files** and upload **the contents** of the `socialpanel-nz` folder. Preserve paths including `js/`, `assets/`, and `supabase/`. Commit to `main`.
4. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)** and Save.
5. The intended address after publication is: `https://frymastercheese.github.io/socialpanel-nz/` (this is NOT a verified live URL until Pages is published).

The static preview needs no backend setup. Every sample order clearly says **preview only**; no card details or money are processed.

## Upgrade to a real database (only in a NEW Supabase project)

1. Create a **new isolated Supabase project** for SocialPanel NZ. **Never run the SQL against your MoneyMate, KiwiKind or other existing projects.**
2. Open its **SQL Editor** and run `supabase/schema.sql` **once**. Confirm the functions, tables and RLS policies are all created. Run Supabase Security Advisors before deployment.
3. In **Project → Connect / API Keys**, copy your **Project URL** and **publishable key** (or legacy **anon key**, not any secret/service-role key).
4. Edit `config.js`:
   ```js
   supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
   supabasePublishableKey: 'sb_publishable_YOUR_PUBLIC_KEY',
   ```
   `config.js` is public. **Never put service-role keys, database passwords, Stripe secret keys or credentials there.**
5. Configure **Authentication → URL Configuration** with the published GitHub Pages URL as Site URL and a valid redirect allow-list entry (e.g. `https://frymastercheese.github.io/socialpanel-nz/**`). Enable email one-time-password sign-in or configure the Google OAuth provider with the correct Google Cloud credentials and Supabase callback.
6. Sign in to SocialPanel NZ. Then in your **NEW** project's SQL Editor open `supabase/owner-setup.sql`, replace the placeholder with **your actual chosen owner email**, execute it and confirm **one correct owner account** appears. Sign out and sign in again to refresh the admin menu.
7. Use Admin centre to create real, verified services with correct pricing. Services remain **draft/unpublished by default** until an authorised admin explicitly marks them active.

**Important:** A connected database can securely store approved orders, but it does not provide a fulfilment supplier or secure payment checkout. A user cannot place an order without verified wallet credit. The owner may manually record verified external payments using unique payment references; this is an administrative accounting action, not proof of money transfer or an integrated payment method. Integrate a real payment provider server-side and test signed webhooks, refunds, taxes and reconciliation before taking any customers.

## Security notes

- Owner permissions come solely from `app_admins` in the separate database; users cannot assign themselves admin status.
- No direct user updates to balances or order status. Wallet deductions are atomic in Postgres and never calculated authoritatively in the browser.
- All currency amounts are stored as integer cents. Credit transactions use unique payment references to prevent retry duplication.
- New services are inactive by default. The static demo catalogue is **not inserted into the production database**.
- In `app_private`, privileged SQL functions check the current auth user and are not exposed as a REST API schema. Public RPC wrappers allow only authenticated users and delegate validations server-side.
- **Review and test** the supplied SQL in a fresh staging project before use with real data. Do not treat this starter as a completed legal, fulfilment, anti-fraud or PCI compliance system.
- Services must follow marketing-platform terms: do not offer fake likes, bot followers, manufactured streams, spam or deceptive results.

## Local preview and checks

```bash
python3 -m http.server 8080
# Open http://localhost:8080/
node --test tests/*.test.js
node --check js/app.js
```

## File layout

```text
index.html / styles.css / config.js   # Frontend and public connection config
js/app.js                              # Interactive dashboard
js/catalog.js                          # Fictional preview catalogue
js/api.js                              # Optional Supabase data adapter
js/utils.js                            # Validation and formatting
assets/favicon.svg                     # Brand icon
privacy.html / terms.html              # Draft public documents
supabase/schema.sql                    # Separate project database bootstrap
supabase/owner-setup.sql               # Owner role bootstrap template
.github/workflows/check.yml            # Repo checks
```

## Before production launch

Add actual business identification and contact details, real service availability, support SLAs, privacy/deletion procedures, live payment processor backend and webhook security, refund handling, GST treatment and accurate legally reviewed policies. Conduct security tests with normal, anonymous and admin users. **No third-party SMM supplier integration is included.**
