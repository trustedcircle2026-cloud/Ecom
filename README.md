# Trusted Circle — Digital Gift Cards

React + Vite storefront with Supabase Auth/Postgres, Netlify Functions and Razorpay Checkout. Gift-card products have unlimited catalogue availability. The administrator manually enters the real voucher code after payment.

## Customer and admin workflow

- Customers browse active products, sign in with Google, add items to their bag and pay through Razorpay.
- Checkout does not check or reserve voucher stock. Active products can be ordered regardless of code availability.
- Razorpay's signed `payment.captured` webhook is the source of truth for the **Paid** order status. The browser payment callback does not mark an order paid.
- Paid orders appear in Admin → Orders as awaiting fulfilment.
- Admin enters one real voucher code per ordered quantity. Each line format is `code,pin,expiry-date`; PIN and expiry are optional.
- After Admin selects **Save codes & mark fulfilled**, the customer can view the code(s) under Account → My orders.
- Voucher codes are stored as plaintext in Supabase. There is no voucher encryption key and no stock upload requirement.

## Deploy to Netlify

Netlify settings are included in `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node: 20 (also specified in `.nvmrc`)

The `netlify/functions/api.js` adapter routes the existing `/api/*` endpoints to Netlify Functions. This includes checkout, authenticated account/admin endpoints and the Razorpay webhook.

## Environment variables

Add these in Netlify → Site configuration → Environment variables:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL used by the browser |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key used by the browser |
| `SUPABASE_URL` | Supabase project URL for server functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role key |
| `RAZORPAY_KEY_ID` | Razorpay Checkout key ID |
| `RAZORPAY_KEY_SECRET` | Server-only Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured on the Razorpay webhook |
| `RESEND_API_KEY` | Optional; email delivery is not implemented |
| `RESEND_FROM_EMAIL` | Optional; email delivery is not implemented |

Do not add `VOUCHER_ENCRYPTION_KEY`. Do not prefix server-only secrets with `VITE_`. Redeploy after changing environment variables.

## Supabase setup

For a new Supabase database:
1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Enable Google in Authentication → Providers and configure the Google OAuth client ID and secret.
3. Add the Supabase callback URL to Google Cloud OAuth authorized redirect URIs.
4. Add your Netlify site URL to Supabase Authentication → URL Configuration.
5. Sign in once using the Google account that should administer the shop.
6. Add that account to the admin allowlist:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'YOUR_ADMIN_GOOGLE_EMAIL'
on conflict (user_id) do nothing;
```

For an existing database created from the earlier project version, run `supabase/manual-fulfilment.sql` once to create the new manual voucher delivery table. Do not run the old stock reservation/fulfilment workflow for this new process.

## Razorpay webhook setup

1. In Razorpay Dashboard → Account & Settings → Webhooks, add:
   `https://YOUR-NETLIFY-SITE/api/razorpay-webhook`
2. Create a webhook secret and copy the exact same value into Netlify as `RAZORPAY_WEBHOOK_SECRET`.
3. Subscribe to `payment.captured` and `payment.failed`.
4. Use Razorpay Test Mode keys for testing before switching to live credentials.

Razorpay Key ID and Key Secret are still required to create a Razorpay checkout order. The webhook secret is separate and is only used to verify webhook messages.

## Security notes

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` server-side in Netlify.
- Never expose these secrets in browser code, screenshots, public repositories or variables prefixed with `VITE_`.
- Plaintext voucher codes are visible to privileged database administrators. Restrict Supabase project access and use the admin-only API to enter codes.
- Only the customer who owns an order can retrieve its voucher codes.

## Test checklist

1. Confirm Google login and admin access.
2. Create an active product and verify that it can be added to the bag with no voucher inventory.
3. Complete a Razorpay test payment.
4. Confirm the Razorpay webhook changes the order to **Paid**.
5. Enter the voucher code(s) in Admin → Orders and mark the order fulfilled.
6. Sign in as the customer and confirm the voucher is visible in My Orders only after fulfilment.
7. Test `payment.failed` and verify the order is not marked Paid.

Email delivery is not currently enabled; the customer account's My Orders page is the digital delivery channel.
