# Trusted Circle — Digital Gift Cards

A digital gift-card storefront built with React + Vite, Supabase Auth/Postgres, Vercel serverless functions and Razorpay. Voucher sourcing is manual; customers pay online and the administrator fulfils paid orders manually.

## Implemented

- Responsive customer storefront and brand/category filtering.
- Live product catalogue and server-calculated checkout prices.
- Google sign-in and sign-out through Supabase Auth.
- Persistent customer cart, order history and voucher reveal after fulfilment.
- Single-admin workspace for products, voucher inventory, orders and customers.
- Unlimited catalogue availability: checkout does not depend on uploaded voucher inventory.
- Razorpay payment verification and webhook confirmation.
- Orders become **Paid** only after successful payment verification.
- Admin manually assigns uploaded voucher codes to paid orders; customer can view them after the order becomes **Fulfilled**.
- Voucher codes and PINs are stored as plaintext in Supabase.

## Important security note

Plaintext voucher storage is less secure. Anyone with privileged database access may be able to read unused voucher codes and PINs. Restrict Supabase dashboard access, keep the service-role key server-side, use a strong administrator account, and never expose inventory through public APIs. The admin-only server endpoints are the only intended inventory management path.

## Local development

1. Use Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Run `npm run dev`. Use Vercel CLI with server-only variables to test API routes.

## Supabase setup

1. Run `supabase/schema.sql` in SQL Editor for a new database.
2. Run `supabase/fulfilment.sql` after the schema.
3. Enable Google under Authentication → Providers and configure the Google OAuth client ID and secret.
4. Add the Supabase callback URL to Google Cloud OAuth authorized redirect URIs.
5. Add the deployed Vercel URL to Supabase Authentication → URL Configuration.
6. Sign in once using the intended administrator Google account.
7. Add that account to the single-admin allowlist:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'YOUR_ADMIN_GOOGLE_EMAIL'
on conflict (user_id) do nothing;
```

If you are upgrading an existing database that previously used encrypted voucher columns, run the updated `supabase/fulfilment.sql` to rename the columns for plaintext storage. Previously encrypted voucher values are not automatically decrypted by this change; re-upload any such stock from the original source if necessary.

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
| `RESEND_API_KEY` | Optional |
| `RESEND_FROM_EMAIL` | Optional |

**Remove `VOUCHER_ENCRYPTION_KEY` from Vercel. It is no longer used.** Keep Supabase service-role and Razorpay secrets server-only; never use a `VITE_` prefix for them.

## Razorpay setup

1. Add Razorpay Key ID and Key Secret to Vercel.
2. Configure webhook URL: `https://YOUR_DOMAIN/api/razorpay-webhook`.
3. Set the matching webhook secret as `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe to `payment.captured` and `payment.failed`.
5. Test using Razorpay test mode before enabling live payments.

## Admin workflow

1. Sign in using the Google account in `admin_users`.
2. Open Admin workspace and create/activate products.
3. Open Voucher stock and upload one voucher per line as `code,pin,YYYY-MM-DD`. PIN and expiry are optional.
4. Monitor Orders. A successful payment changes the order to **Paid**.
5. Upload the corresponding genuine voucher code(s), then click **Fulfil paid order manually** on that order.
6. The system assigns available uploaded voucher records to the order and marks it **Fulfilled** only when every ordered quantity has a voucher.
7. The customer can then open Account → My orders → View voucher details.

An order can be placed even when no voucher code is currently uploaded. Payment success confirms the order but does not automatically deliver a voucher. The admin must fulfil it after payment.

## Customer workflow

1. Browse products and add them to the bag.
2. Sign in with Google and complete Razorpay checkout.
3. After successful payment, the order appears as **Paid**.
4. Wait for the administrator to assign the voucher.
5. Open Account → My orders to view voucher details once the order is **Fulfilled**.

## Deployment checklist

- Apply SQL scripts in order.
- Confirm the administrator account is allowlisted.
- Configure Supabase OAuth and all Vercel environment variables.
- Configure Razorpay webhook and verify test events.
- Test payment success, payment failure, order marked Paid, manual voucher upload, manual fulfilment, and customer voucher reveal.
- Email delivery is not enabled; the customer order page is the current delivery channel.
