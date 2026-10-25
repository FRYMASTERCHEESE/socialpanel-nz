# SocialPanel NZ

A **completely separate**, mobile-first SMM dashboard built for **GitHub Pages**. Features a service-ID price table and prominent new-order form inspired by familiar SMM panel workflows, without reusing or touching an existing website.

**Current build: safe preview + optional secure database foundation.** The site is **not a live payment or service-delivery operation**. All 32 storefront sample prices are invented NZD examples per 1,000 units. No supplier rates, expected delivery time, quality or refill promises have been verified. Do not accept customer funds or claim delivery until a genuine provider, business details, legal terms, payment processor and fulfilment process are verified.

## Included

- Dedicated **New Order** home page with platform → numbered service → public URL → quantity → price preview
- 18 social platform categories, **32 fictional low-price demo listings**, rate-per-1,000 service table with IDs, minimum/maximum units, search, sorting and favourites
- Accurate quantity pricing based on a rate per 1,000 rounded up to cents; local-only preview orders (no charge or supplier request)
- Order history, wallet, ticket support, explicit non-connected API page, light/dark mode
- Draft privacy and terms pages. Platform rules may prohibit bought or artificial engagement
- Optional **Supabase** customer authentication, private orders and tickets, wallet ledger, owner-only admin catalogue, owner-only manual balance credits
- Strict database RLS, a locked/transactional order RPC, idempotent wallet-credit references and refunds on cancellation
- Owner-only **SMMFollows API price preview bridge** (read-only, locked until a new Supabase backend and private supplier key are configured)
- No ads or analytics trackers, no card collection, no supplier order fulfilment
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

**Important:** A connected database can securely store approved orders, but it does not provide a fulfilment supplier or secure payment checkout. The standalone database includes a private `app_private.panel_controls.order_intake_enabled` default-FALSE gate. Real order intake must not be enabled until supplier verification, pricing, terms, tax, customer protection and payment reconciliation are ready. A user cannot place an order without verified wallet credit. The owner may manually record verified external payments using unique payment references; this is an administrative accounting action, not proof of money transfer or an integrated payment method. Integrate a real payment provider server-side and test signed webhooks, refunds, taxes and reconciliation before taking any customers.

## SMMFollows supplier connection — owner-only read-only preview

The SMMFollows screenshot shows the fixed endpoint `POST https://smmfollows.com/api/v2`, with an API key available in the **SMMFollows → Account** page. The provider documents `action=services` for catalogues and `action=balance` for balances. The screenshot's `rate: "0.90"` is an **example**, not a verified rate; service list API returns actual rates only when your account is authenticated.

### Connect without exposing your API key

1. Set up a **dedicated new Supabase project** for SocialPanel NZ following the database steps above. Current repositories and unrelated Supabase databases must not be reused. Run `supabase/schema.sql`, then promote the **correct** SocialPanel owner account using `supabase/owner-setup.sql`.
2. Sign into `https://smmfollows.com/`, open **Account**, find or generate an API key for your own account. **Do not paste the key into GitHub, `config.js`, your browser, screenshots, GitHub Actions logs, or ChatGPT.** Treat it as a password.
3. In your new SocialPanel project's **Supabase Edge Function Secrets**, create `SMMFOLLOWS_API_KEY` with that key. Keep the value private. (This is unrelated to your Supabase publishable client key.)
4. Deploy only the read-only function `supabase/functions/smmfollows-preview/index.ts` to that project. With the Supabase CLI linked to the **new SocialPanel project only**, the documented command is `supabase functions deploy smmfollows-preview`. `supabase/config.toml` retains JWT verification.
5. In public `config.js`, set only the new project's URL and its browser-safe **publishable** API key; sign into SocialPanel NZ as the owner. In **Admin centre → Supplier connection**, click **Check supplier prices** or **Check supplier balance**.
6. Review exact service IDs, provider currency, rates per 1,000, quantity limits, platform policies and supplier refund terms. The displayed rates remain **private**, unconverted supplier quotes. This function cannot import, edit, activate, order, refill, cancel, or charge anyone. Public sample prices remain fictional until replaced by separately reviewed prices.

**Safety:** SMMFollows might itself be a reseller; an API does not prove it is the source supplier or that its services comply with social platforms' terms. Do not publish unverified listings, deposit significant funds or promise organic engagement. The feature never uses `action=add`; no real orders can be placed via this integration.

### Private API contract

- `POST /functions/v1/smmfollows-preview` with authenticated **owner** session and `{"action":"services"}` returns at most 300 validated service records; the response explicitly labels currency `UNVERIFIED`.
- `{"action":"balance"}` returns your private supplier balance if the provider supports it.
- Non-owner and unsigned requests are denied. CORS permits the approved GitHub Pages origin, but server-side owner checks enforce access regardless of origin.
- No supplier API key appears in frontend code or repository files.

## Security notes

- Owner permissions come solely from `app_admins` in the separate database; users cannot assign themselves admin status.
- No direct user updates to balances or order status. Wallet deductions are atomic in Postgres and never calculated authoritatively in the browser.
- All currency amounts are stored as integer cents. Credit transactions use unique payment references to prevent retry duplication.
- New services are inactive by default and all real orders are disabled by both the frontend and the database default gate. The static demo catalogue is **not inserted into the production database**.
- In `app_private`, privileged SQL functions check the current auth user and are not exposed as a REST API schema. Public RPC wrappers allow only authenticated users and delegate validations server-side.
- **Review and test** the supplied SQL in a fresh staging project before use with real data. Do not treat this starter as a completed legal, fulfilment, anti-fraud or PCI compliance system.
- Numerous major platforms prohibit buying or selling artificial engagement. Demo rows model common industry service names but are **not endorsements, representations of real availability, offers or guarantees**. For launch, offer only services verified as permissible under the relevant platform rules, and disclose all material limitations.

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

Add actual business identification and contact details, real service availability, support SLAs, privacy/deletion procedures, live payment processor backend and webhook security, refund handling, GST treatment and accurate legally reviewed policies. Conduct security tests with normal, anonymous and admin users. **A read-only SMMFollows supplier-preview bridge is staged but not deployed; no third-party order fulfilment is connected.**
