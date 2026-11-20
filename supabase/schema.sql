-- Trusted Circle digital gift card platform
-- Apply in Supabase SQL Editor. Review policies before production launch.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id),
  name text not null,
  brand text not null,
  category text not null,
  denomination integer not null check (denomination > 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.voucher_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  code_ciphertext text not null,
  pin_ciphertext text,
  expiry_date date,
  status text not null default 'available' check (status in ('available','reserved','delivered','void')),
  order_item_id uuid,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null default 1 check (quantity between 1 and 10),
  created_at timestamptz not null default now(),
  unique(cart_id, product_id)
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id),
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','processing','fulfilled','cancelled','refunded','payment_failed')),
  currency text not null default 'INR',
  subtotal numeric(12,2) not null,
  total numeric(12,2) not null,
  razorpay_order_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  brand text not null,
  denomination integer not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now()
);
alter table public.voucher_inventory add constraint voucher_inventory_order_item_fk foreign key(order_item_id) references public.order_items(id);
create table if not exists public.order_vouchers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  code text not null,
  pin text,
  expiry_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null default 'razorpay',
  provider_payment_id text unique,
  provider_order_id text,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','authorized','captured','failed','refunded')),
  signature_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email, avatar_url)
  values(new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, avatar_url = excluded.avatar_url;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.voucher_inventory enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_vouchers enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

create policy "profiles select own" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "brands public active" on public.brands for select using (is_active or public.is_admin());
create policy "brands admin manage" on public.brands for all using (public.is_admin()) with check (public.is_admin());
create policy "products public active" on public.products for select using (is_active or public.is_admin());
create policy "products admin manage" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "carts own" on public.carts for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "cart items own" on public.cart_items for all using (exists(select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin()))) with check (exists(select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin())));
create policy "orders own read" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "order items own read" on public.order_items for select using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy "order vouchers customer read" on public.order_vouchers for select using (exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=order_item_id and (o.user_id=auth.uid() or public.is_admin())));
create policy "payments own read" on public.payments for select using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy "inventory admin only" on public.voucher_inventory for all using (public.is_admin()) with check (public.is_admin());
create policy "webhook events admin only" on public.webhook_events for all using (public.is_admin()) with check (public.is_admin());
create policy "admin users self or admin read" on public.admin_users for select using (user_id = auth.uid() or public.is_admin());
-- Intentionally no client insert/update policies on orders, order_items or payments.
-- Only trusted server functions with the Supabase service role may create/settle payments and allocate voucher stock.

insert into public.brands(name,slug) values
('Amazon','amazon'),('Flipkart','flipkart'),('Myntra','myntra'),('Swiggy','swiggy'),
('Zomato','zomato'),('Tata CLiQ','tata-cliq'),('Croma','croma'),('Other brands','other-brands')
on conflict (slug) do nothing;

-- Example admin bootstrap after the first Google login:
-- insert into public.admin_users(user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
