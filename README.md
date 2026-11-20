# Trusted Circle — Digital Gift Cards

A React + Vite storefront foundation for branded digital gift cards. Supabase is the system of record; Vercel hosts the frontend and secure serverless checkout endpoints; Razorpay handles payments.

## Included in this first implementation
- Responsive storefront, brand/category browsing, denominations and search.
- Local cart with quantity controls and totals.
- Supabase Google OAuth sign-in/sign-out wiring.
- Supabase schema for profiles, brands, products, manual voucher inventory, carts, orders, order items, payments, webhook idempotency and one-admin roles.
- RLS baseline: voucher codes are never readable by customers; order/payment writes are server-only.
- Seeded initial brands: Amazon, Flipkart, Myntra, Swiggy, Zomato, Tata CLiQ, Croma and Other brands.

## Local development
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Run `npm run dev`.

The storefront can be previewed without Supabase, but Google authentication requires the environment variables and provider configuration.

## Supabase setup
1. Create/use your Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. In Authentication → Providers, enable Google and enter the Google OAuth client ID/secret.
4. Add the Supabase callback URL shown in the provider settings to the Google Cloud OAuth authorized redirect URIs.
5. In Authentication → URL Configuration, add your Vercel production URL and local development URL to the allowed redirect URLs.
6. Sign in once with the intended administrator Google account. Copy that user's UUID from Authentication → Users and run:
   `insert into public.admin_users(user_id) values ('USER_UUID');`
7. Keep the Supabase service-role key server-side only.

## Vercel environment variables
Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only (for the checkout functions to be added in the payment milestone):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ADMIN_EMAIL`

Never prefix private secrets with `VITE_`. Never commit secrets to GitHub.

## Payment and fulfilment release gate
The storefront intentionally does **not** pretend to take live payments yet. Before production checkout, implement Vercel server endpoints to:
1. Re-read product prices and available voucher stock on the server; never trust browser totals.
2. Create a pending order and Razorpay order using server-only credentials.
3. Verify Razorpay payment signatures server-side.
4. Verify webhook signatures against the raw request body and persist event IDs for idempotency.
5. Atomically allocate one available manual voucher per paid order item, mark it delivered, and expose voucher details only to the owning customer after fulfilment.
6. Send the voucher email through a configured transactional email provider and retain a secure order-history view.
7. Handle payment failures, refunds, stock races and duplicate webhook events.

Manual inventory means the administrator must upload genuine voucher codes and PINs obtained from authorized sources. Store encrypted voucher secrets, not plaintext. Use a server-side encryption key (for example, AES-256-GCM) stored only in Vercel environment variables; the schema's `code_ciphertext` and `pin_ciphertext` columns are intended for encrypted values.

## Deployment
Import this GitHub repository into Vercel, select the Vite framework preset and deploy. Set environment variables in Vercel, then redeploy. Connect the Supabase project and configure OAuth redirect URLs to match the deployed domain.

## Current status
This is the initial storefront + auth/schema foundation. Live Razorpay checkout, encrypted voucher upload, transactional email, order fulfilment and admin CRUD screens are the next implementation milestone; do not accept real customer payments until those server-side controls are deployed and tested.
