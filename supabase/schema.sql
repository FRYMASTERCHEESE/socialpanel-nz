-- SocialPanel NZ standalone database bootstrap (run ONLY in a NEW, isolated Supabase project).
-- No real payments, fake engagement, supplier APIs or admin accounts are enabled by this file.
-- Requires Supabase Auth (auth.users/auth.uid/auth.jwt); Postgres 15+ recommended.
-- IMPORTANT: review policies / run security advisors before taking real customers.

begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0 and balance_cents <= 10000000000),
  updated_at timestamptz not null default now()
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 30),
  platform text not null check (platform in ('facebook','youtube','instagram','tiktok','x','linkedin','telegram','spotify','soundcloud','website','pinterest','bluesky','kick','vimeo','dailymotion','shazam','reddit','other')),
  name text not null check (char_length(name) between 3 and 150),
  description text not null default '' check (char_length(description) <= 1500),
  price_cents integer not null check (price_cents between 1 and 10000000),
  unit text not null default 'per campaign' check (char_length(unit) between 1 and 40),
  delivery text not null default 'To be agreed' check (char_length(delivery) between 1 and 80),
  featured boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.services(id),
  service_code text not null,
  service_name text not null,
  platform text not null,
  target_url text not null check (char_length(target_url) between 10 and 2000 and target_url ~* '^https?://[^[:space:]]+$'),
  quantity integer not null check (quantity between 1 and 100),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','processing','completed','cancelled','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_recent_idx on public.orders(user_id,created_at desc);
create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta_cents bigint not null check (delta_cents <> 0),
  reference text not null unique check (char_length(reference) between 5 and 200),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_user_recent_idx on public.wallet_ledger(user_id,created_at desc);
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 5 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now()
);

-- Populate a zero-balance account when a user is created. No paid credit is issued.
create or replace function app_private.new_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values (new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing;
  insert into public.wallets(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end; $$;
drop trigger if exists socialpanel_new_user on auth.users;
create trigger socialpanel_new_user after insert on auth.users for each row execute function app_private.new_account();
-- Handle users who signed up before the bootstrap script was run.
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;
insert into public.wallets(user_id) select id from auth.users on conflict (user_id) do nothing;

-- This private helper is used by RLS and by privileged operations.
create or replace function app_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false) = false
    and exists (select 1 from public.app_admins where user_id=(select auth.uid()));
$$;

alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;

create policy "profile private read" on public.profiles for select to authenticated using (id=(select auth.uid()) or (select app_private.is_admin()));
create policy "profile owner update" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "admins see their own role" on public.app_admins for select to authenticated using(user_id=(select auth.uid()));
create policy "wallet owner read" on public.wallets for select to authenticated using(user_id=(select auth.uid()) or (select app_private.is_admin()));
create policy "ledger owner read" on public.wallet_ledger for select to authenticated using(user_id=(select auth.uid()) or (select app_private.is_admin()));
create policy "services public read" on public.services for select to anon using(is_active);
create policy "services active or owner read" on public.services for select to authenticated using(is_active or (select app_private.is_admin()));
create policy "admins create services" on public.services for insert to authenticated with check((select app_private.is_admin()));
create policy "admins edit services" on public.services for update to authenticated using((select app_private.is_admin())) with check((select app_private.is_admin()));
create policy "admins remove services" on public.services for delete to authenticated using((select app_private.is_admin()));
create policy "orders own or admin read" on public.orders for select to authenticated using(user_id=(select auth.uid()) or (select app_private.is_admin()));
create policy "tickets own or admin read" on public.tickets for select to authenticated using(user_id=(select auth.uid()) or (select app_private.is_admin()));
create policy "users create own ticket" on public.tickets for insert to authenticated with check(user_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy "admins update tickets" on public.tickets for update to authenticated using((select app_private.is_admin())) with check((select app_private.is_admin()));

-- Explicit grants accompany RLS. Never grant direct wallet/order mutation permissions to customers.
revoke all on public.app_admins,public.wallets,public.wallet_ledger,public.orders,public.profiles,public.services,public.tickets from anon,authenticated;
grant select on public.services to anon,authenticated;
grant select on public.profiles,public.app_admins,public.wallets,public.wallet_ledger,public.orders,public.tickets to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert,update,delete on public.services to authenticated; -- protected by the RLS admin policies
-- Restrict customer ticket inserts to permitted fields, not user_id/status.
grant insert(subject,message) on public.tickets to authenticated;
grant update(status) on public.tickets to authenticated; -- admin-only RLS

create or replace function public.my_balance() returns bigint
language sql stable security invoker set search_path = '' as $$
  select case when (select auth.uid()) is not null then coalesce((select balance_cents from public.wallets where user_id=(select auth.uid())),0) else 0 end;
$$;

-- Privileged business logic is implemented in a NON-exposed schema.
create or replace function app_private.place_order(p_service_id uuid,p_target_url text,p_quantity integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_service public.services%rowtype; v_total bigint; v_available bigint; v_id uuid;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in to place an order'; end if;
  if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Quantity must be 1–100'; end if;
  if p_target_url is null or char_length(p_target_url) not between 10 and 2000 or p_target_url !~* '^https?://[^[:space:]]+$' then raise exception 'A valid public URL is required'; end if;
  select * into v_service from public.services where id=p_service_id and is_active=true;
  if not found then raise exception 'Service is unavailable'; end if;
  v_total := v_service.price_cents::bigint*p_quantity::bigint;
  select balance_cents into v_available from public.wallets where user_id=v_uid for update;
  if not found then raise exception 'Wallet missing'; end if;
  if v_available < v_total then raise exception 'Insufficient verified wallet balance'; end if;
  update public.wallets set balance_cents=balance_cents-v_total,updated_at=now() where user_id=v_uid;
  insert into public.orders(user_id,service_id,service_code,service_name,platform,target_url,quantity,amount_cents)
  values(v_uid,v_service.id,v_service.code,v_service.name,v_service.platform,p_target_url,p_quantity,v_total) returning id into v_id;
  insert into public.wallet_ledger(user_id,delta_cents,reference,note) values(v_uid,-v_total,'order:'||v_id,'Purchase: '||v_service.name);
  return v_id;
end; $$;
create or replace function public.place_order(p_service_id uuid,p_target_url text,p_quantity integer) returns uuid
language sql security invoker set search_path = '' as $$
  select app_private.place_order(p_service_id,p_target_url,p_quantity);
$$;

create or replace function app_private.admin_set_order_status(p_order_id uuid,p_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_row public.orders%rowtype;
begin
  if auth.uid() is null or not app_private.is_admin() then raise exception 'Not authorised'; end if;
  if p_status not in ('pending','processing','completed','cancelled','refunded') then raise exception 'Invalid status'; end if;
  select * into v_row from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_row.status in ('refunded','cancelled') and p_status not in ('refunded','cancelled') then raise exception 'Refunded orders cannot be reactivated'; end if;
  if v_row.status not in ('refunded','cancelled') and p_status in ('refunded','cancelled') then
    update public.wallets set balance_cents=balance_cents+v_row.amount_cents,updated_at=now() where user_id=v_row.user_id;
    insert into public.wallet_ledger(user_id,delta_cents,reference,note) values(v_row.user_id,v_row.amount_cents,'refund:'||p_order_id,'Refund for cancelled/refunded order');
  end if;
  update public.orders set status=p_status,updated_at=now() where id=p_order_id;
  return true;
end; $$;
create or replace function public.admin_set_order_status(p_order_id uuid,p_status text) returns boolean
language sql security invoker set search_path = '' as $$ select app_private.admin_set_order_status(p_order_id,p_status); $$;

create or replace function app_private.admin_credit_wallet(p_user_id uuid,p_amount_cents bigint,p_reference text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_exists uuid;
begin
  if auth.uid() is null or not app_private.is_admin() then raise exception 'Not authorised'; end if;
  if p_user_id is null or p_amount_cents is null or p_amount_cents not between 1 and 10000000 then raise exception 'Invalid credit amount or user'; end if;
  if p_reference is null or char_length(trim(p_reference)) not between 3 and 120 then raise exception 'A unique payment reference is required'; end if;
  select user_id into v_exists from public.wallets where user_id=p_user_id for update;
  if not found then raise exception 'Account does not exist'; end if;
  -- A unique external reference makes retried deposits idempotent (duplicate raises and rolls back).
  insert into public.wallet_ledger(user_id,delta_cents,reference,note) values(p_user_id,p_amount_cents,'payment:'||trim(p_reference),'Manually verified payment; admin '||auth.uid());
  update public.wallets set balance_cents=balance_cents+p_amount_cents,updated_at=now() where user_id=p_user_id;
  return true;
end; $$;
create or replace function public.admin_credit_wallet(p_user_id uuid,p_amount_cents bigint,p_reference text) returns boolean
language sql security invoker set search_path = '' as $$ select app_private.admin_credit_wallet(p_user_id,p_amount_cents,p_reference); $$;

revoke all on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.place_order(uuid,text,integer) to authenticated;
grant execute on function app_private.admin_set_order_status(uuid,text) to authenticated;
grant execute on function app_private.admin_credit_wallet(uuid,bigint,text) to authenticated;
revoke execute on function public.my_balance(),public.place_order(uuid,text,integer),public.admin_set_order_status(uuid,text),public.admin_credit_wallet(uuid,bigint,text) from public,anon;
grant execute on function public.my_balance(),public.place_order(uuid,text,integer),public.admin_set_order_status(uuid,text),public.admin_credit_wallet(uuid,bigint,text) to authenticated;
-- Restrict new_account execution; only trigger invocation should be used for signup.
-- Do NOT grant this private trigger helper to browser roles.

commit;
