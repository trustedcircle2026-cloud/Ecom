-- Apply after schema.sql. Safe to run more than once.
alter table public.voucher_inventory add column if not exists reserved_until timestamptz;
create index if not exists voucher_inventory_available_idx on public.voucher_inventory(product_id,created_at) where status='available';
create index if not exists voucher_inventory_order_item_idx on public.voucher_inventory(order_item_id);
create index if not exists voucher_inventory_reservation_idx on public.voucher_inventory(reserved_until) where status='reserved';
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
-- This deployment is intentionally single-admin: only one row can be allowlisted.
create unique index if not exists admin_users_single_admin_idx on public.admin_users ((true));

create or replace function public.reserve_order_vouchers(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_order public.orders%rowtype;
 v_item record;
 v_count integer;
 v_total integer:=0;
begin
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.status<>'pending_payment' then raise exception 'Order is not awaiting payment'; end if;

 -- Release stale unpaid reservations before allocating stock to this order.
 update public.voucher_inventory set status='available',order_item_id=null,reserved_until=null
 where status='reserved' and reserved_until<now();

 for v_item in select * from public.order_items where order_id=p_order_id order by created_at for update loop
  select count(*) into v_count from public.voucher_inventory where order_item_id=v_item.id and status='reserved' and reserved_until>now();
  if v_count<v_item.quantity then
   with candidates as (
    select id from public.voucher_inventory
    where product_id=v_item.product_id and status='available' and (expiry_date is null or expiry_date>=current_date)
    order by created_at limit (v_item.quantity-v_count) for update skip locked
   )
   update public.voucher_inventory vi set status='reserved',order_item_id=v_item.id,reserved_until=now()+interval '30 minutes'
   from candidates c where vi.id=c.id;
   select count(*) into v_count from public.voucher_inventory where order_item_id=v_item.id and status='reserved' and reserved_until>now();
  end if;
  if v_count<v_item.quantity then raise exception 'Insufficient voucher stock for product %',v_item.product_id; end if;
  v_total:=v_total+v_item.quantity;
 end loop;
 return jsonb_build_object('reserved',true,'voucher_count',v_total);
end;
$$;

create or replace function public.fulfil_paid_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_order public.orders%rowtype;
 v_item record;
 v_allocated integer;
 v_after integer;
 v_total integer:=0;
begin
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.status='fulfilled' then return jsonb_build_object('status','fulfilled','already_fulfilled',true); end if;
 if v_order.status not in ('paid','processing') then raise exception 'Order is not paid'; end if;

 for v_item in select * from public.order_items where order_id=p_order_id order by created_at for update loop
  update public.voucher_inventory set status='delivered',reserved_until=null
  where order_item_id=v_item.id and status='reserved';
  select count(*) into v_allocated from public.voucher_inventory where order_item_id=v_item.id and status='delivered';
  if v_allocated<v_item.quantity then
   with candidates as (
    select id from public.voucher_inventory
    where product_id=v_item.product_id and status='available' and (expiry_date is null or expiry_date>=current_date)
    order by created_at limit (v_item.quantity-v_allocated) for update skip locked
   )
   update public.voucher_inventory vi set status='delivered',order_item_id=v_item.id
   from candidates c where vi.id=c.id;
   select count(*) into v_after from public.voucher_inventory where order_item_id=v_item.id and status='delivered';
   if v_after<v_item.quantity then raise exception 'Insufficient voucher inventory for product % (needed %, available %)',v_item.product_id,v_item.quantity,v_after; end if;
  end if;
  v_total:=v_total+v_item.quantity;
 end loop;
 update public.orders set status='fulfilled' where id=p_order_id;
 return jsonb_build_object('status','fulfilled','voucher_count',v_total);
end;
$$;

revoke all on function public.reserve_order_vouchers(uuid) from public,anon,authenticated;
revoke all on function public.fulfil_paid_order(uuid) from public,anon,authenticated;
grant execute on function public.reserve_order_vouchers(uuid) to service_role;
grant execute on function public.fulfil_paid_order(uuid) to service_role;
