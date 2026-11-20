# Trusted Circle — Digital Gift Cards

A digital gift-card storefront built with React + Vite, Supabase Auth/Postgres, Vercel serverless functions and Razorpay. Voucher sourcing is manual; voucher delivery is digital.

## Implemented

- Responsive customer storefront and brand/category filtering.
- Initial brands: Amazon, Flipkart, Myntra, Swiggy, Zomato, Tata CLiQ, Croma and Other brands.
- Live product catalogue from Supabase; product prices are read again by the server during checkout.
- Local shopping cart with quantity controls and Supabase persistence for signed-in customers.
- Google sign-in and sign-out through Supabase Auth.
- Single-admin access based on the `admin_users` table, never a browser-supplied email flag.
- Admin workspace: product creation, activation/deactivation, order list, and secure bulk voucher upload.
- Voucher code/PIN encryption using AES-256-GCM before storage.
- Server-side Razorpay order creation and payment signature verification.
- Razorpay webhook signature verification with event IDs and retry-safe order processing.
- Atomic 30-minute stock reservations before payment, followed by voucher allocation using PostgreSQL row locks and `SKIP LOCKED`.
- Single-admin allowlist enforced by a unique database index.
- Customer order history and voucher reveal only after the order is fulfilled.
- Admin retry for paid orders waiting for voucher inventory.

## Local development

1. Use Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the storefront.
5. Run `npm run dev`.

The serverless API routes run on Vercel. For local API testing, use the Vercel CLI (`vercel dev`) with the server-only environment variables configured.

## Supabase setup

1. Open the existing Supabase project and run `supabase/schema.sql` in SQL Editor (initial schema).
2. Then run `supabase/fulfilment.sql` (indexes and atomic voucher fulfilment function).
3. Enable Google in Authentication → Providers and configure the Google OAuth client ID/secret.
4. Add the Supabase callback URL to Google Cloud OAuth authorized redirect URIs.
5. Add the Vercel production URL and local URL to Supabase Authentication → URL Configuration.
6. Sign in once with the intended administrator Google account.
7. In SQL Editor, grant the single administrator role:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'YOUR_ADMIN_GOOGLE_EMAIL'
on conflict (user_id) do nothing;
```

Only this allowlisted user can open the admin workspace and manage catalogue/inventory.

## Vercel environment variables

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Scope |
|---|---|
| `VITE_SUPABASE_URL` | Frontend |
| `VITE_SUPABASE_ANON_KEY` | Frontend |
| `SUPABASE_URL` | Server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `RAZORPAY_KEY_ID` | Server only |
| `RAZORPAY_KEY_SECRET` | Server only |
| `RAZORPAY_WEBHOOK_SECRET` | Server only |
| `VOUCHER_ENCRYPTION_KEY` | Server only |
| `RESEND_API_KEY` | Optional email provider |
| `RESEND_FROM_EMAIL` | Optional verified sender |

Generate an encryption key locally with:

```bash
openssl rand -hex 32
```

Use the same key for every deployment environment that needs to decrypt existing vouchers. Losing or changing it without a controlled key rotation will make previously stored vouchers unreadable. Never commit secrets or expose service-role/payment secrets through `VITE_` variables.

## Razorpay setup

1. Configure the Razorpay Key ID and Key Secret in Vercel.
2. Add a Razorpay webhook pointing to `https://YOUR_DOMAIN/api/razorpay-webhook`.
3. Use the same webhook secret in `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe to `payment.captured` and `payment.failed`.
5. Test with Razorpay test mode before enabling live keys.

## Admin workflow

1. Sign in using the Google account allowlisted in `admin_users`.
2. Open Account → Admin workspace.
3. Create a product with brand, denomination, category and selling price.
4. Open Voucher stock and select the product.
5. Paste one voucher per line as `code,pin,YYYY-MM-DD` (PIN and expiry are optional).
6. The server encrypts voucher code and PIN with AES-256-GCM before saving.
7. Monitor orders. Paid orders are allocated from available stock using a database function. If stock is unavailable, upload stock and use Retry voucher fulfilment.

Upload only vouchers obtained from authorized sources. Treat source spreadsheets and raw voucher codes as highly sensitive.

## Customer workflow

1. Browse live gift cards and add products to the cart.
2. Sign in with Google.
3. Complete Razorpay checkout.
4. The server verifies the payment signature.
5. Voucher allocation is performed by the database function.
6. The customer opens Account → My orders → View voucher details after fulfilment.

## Deployment

1. Import this repository into Vercel using the Vite preset.
2. Configure all environment variables above.
3. Deploy and configure Supabase OAuth URLs and Razorpay webhook URL for the deployed domain.
4. Apply both SQL files in order.
5. Test a complete order in Razorpay test mode with a real test voucher before accepting customer payments.

## Production launch checks

- The project must be built and tested in the connected Vercel environment.
- Confirm that the Supabase schema and fulfilment SQL have both been applied.
- Confirm that the intended Google account exists in `admin_users`.
- Confirm that Vercel has all server-only secrets, especially the encryption key.
- Confirm webhook delivery and duplicate-event handling.
- Test insufficient stock, payment failure, successful payment, order history, voucher reveal and admin retry.
- Email delivery is not yet enabled; the customer order page is the current digital delivery channel. A verified transactional email provider can be configured as a separate release task.
