-- Apply after schema.sql. Safe to run more than once.
create index if not exists voucher_inventory_available_idx on public.voucher_inventory(product_id,created_at) where status='available';
create index if not exists voucher_inventory_order_item_idx on public.voucher_inventory(order_item_id);
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);

create or replace function public.fulfil_paid_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_allocated integer;
  v_total integer:=0;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status='fulfilled' then return jsonb_build_object('status','fulfilled','already_fulfilled',true); end if;
  if v_order.status not in ('paid','processing') then raise exception 'Order is not paid'; end if;

  for v_item in select * from public.order_items where order_id=p_order_id order by created_at for update loop
    select count(*) into v_allocated from public.voucher_inventory where order_item_id=v_item.id and status='delivered';
    if v_allocated < v_item.quantity then
      with candidates as (
        select id from public.voucher_inventory
        where product_id=v_item.product_id and status='available'
          and (expiry_date is null or expiry_date>=current_date)
        order by created_at
        for update skip locked
        limit (v_item.quantity-v_allocated)
      )
      update public.voucher_inventory vi
      set status='delivered',order_item_id=v_item.id
      from candidates c where vi.id=c.id;
      get diagnostics v_allocated = row_count;
      if v_allocated < (v_item.quantity-(select count(*) from public.voucher_inventory where order_item_id=v_item.id and status='delivered')+v_allocated) then
        raise exception 'Insufficient voucher inventory for product %',v_item.product_id;
      end if;
    end if;
    v_total:=v_total+v_item.quantity;
  end loop;
  update public.orders set status='fulfilled' where id=p_order_id;
  return jsonb_build_object('status','fulfilled','voucher_count',v_total);
end;
$$;
revoke all on function public.fulfil_paid_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfil_paid_order(uuid) to service_role;
