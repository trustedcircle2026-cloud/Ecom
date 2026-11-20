-- Run once on an existing Supabase database.
-- Manual voucher fulfilment: no inventory, stock reservation or encryption key required.
create table if not exists public.order_vouchers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  code text not null,
  pin text,
  expiry_date date,
  created_at timestamptz not null default now()
);
alter table public.order_vouchers enable row level security;
drop policy if exists "order vouchers customer read" on public.order_vouchers;
create policy "order vouchers customer read" on public.order_vouchers
for select using (
  exists (
    select 1 from public.order_items i
    join public.orders o on o.id=i.order_id
    where i.id=order_item_id and (o.user_id=auth.uid() or public.is_admin())
  )
);
