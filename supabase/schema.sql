-- ============================================================================
-- ALLIANCE COLIS — SCHEMA v1.0.1 PRODUCTION
-- Logistique par entrepôt central + livraisons groupées, GPS optionnel.
-- Ce fichier documente l'état réel de la base (appliqué directement en
-- production via le connecteur Supabase). Idempotent (if not exists partout)
-- SAUF la reconstruction initiale du sous-système commande/livraison, déjà
-- effectuée en production — ne pas rejouer sur une base contenant des
-- commandes réelles sans adapter (voir historique des migrations Supabase).
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
create type user_role as enum (
  'customer', 'seller_pending', 'seller', 'courier_pending', 'courier', 'admin'
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  country text not null,
  role user_role not null default 'customer',
  verified boolean not null default false,
  avatar_url text,
  terms_accepted boolean not null default false,
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. KYC DOCUMENTS
-- ============================================================================
create type kyc_target as enum ('seller', 'courier');
create type kyc_status as enum ('pending', 'approved', 'rejected');

create table if not exists kyc_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  target kyc_target not null,
  full_name text not null,
  phone text not null,
  id_document_url text not null,
  shop_name text,
  shop_description text,
  vehicle_type text,
  status kyc_status not null default 'pending',
  admin_comment text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ============================================================================
-- 3. SHOPS
-- ============================================================================
create type shop_status as enum ('pending', 'approved', 'blocked');

create table if not exists shops (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  shop_lat double precision,
  shop_lng double precision,
  status shop_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 4. PRODUCTS
-- ============================================================================
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  photo_url text,
  active boolean not null default true,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5. CART
-- ============================================================================
create table if not exists cart (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ============================================================================
-- 6. WAREHOUSES — entrepôts Alliance Colis (point de départ des livraisons)
-- ============================================================================
create table if not exists warehouses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  warehouse_lat double precision not null,
  warehouse_lng double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Seed initial (une fois) :
-- insert into warehouses (name, address, warehouse_lat, warehouse_lng, active)
-- values ('Entrepôt principal', '<adresse réelle>', <lat>, <lng>, true);

-- ============================================================================
-- 7. ORDER_BATCHES — le LOT facturé et livré au client (une seule livraison,
-- même si le panier contient plusieurs boutiques). Porte tarification,
-- géolocalisation, code de suivi et paiement.
-- ============================================================================
create type location_source as enum ('gps', 'address', 'manual_confirmation');
create type order_status as enum ('pending', 'confirmed', 'processing', 'completed', 'cancelled');

create sequence if not exists order_number_seq start 1;

create table if not exists order_batches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id),
  status order_status not null default 'pending',
  items_total numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  delivery_address text not null,
  delivery_lat double precision,
  delivery_lng double precision,
  location_source location_source not null default 'address',
  distance_km numeric(6,2),
  tracking_code text unique,
  payment_session_token text,
  created_at timestamptz not null default now()
);

create or replace function set_batch_tracking_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tracking_code is null then
    new.tracking_code := 'AC-' || lpad(nextval('order_number_seq')::text, 11, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_batch_tracking_code on order_batches;
create trigger trg_set_batch_tracking_code
  before insert on order_batches
  for each row execute function set_batch_tracking_code();

create index if not exists idx_order_batches_user_id on order_batches(user_id);
create index if not exists idx_order_batches_payment_session_token on order_batches(payment_session_token);

-- ============================================================================
-- 8. ORDERS — ligne d'exécution PAR BOUTIQUE au sein d'un lot (préparation,
-- commission vendeur). Ne porte plus ni livraison ni code de suivi client.
-- ============================================================================
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references order_batches(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid not null references shops(id),
  status order_status not null default 'pending',
  items_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_orders_batch_id on orders(batch_id);
create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_shop_id on orders(shop_id);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0)
);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_order_items_product_id on order_items(product_id);

-- ============================================================================
-- 9. PAYMENTS — un paiement par LOT
-- ============================================================================
create type payment_provider as enum ('cinetpay', 'wave', 'mtn', 'moov', 'orange', 'senepay');
create type payment_status as enum ('pending', 'success', 'failed');

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references order_batches(id) on delete cascade,
  provider payment_provider not null,
  status payment_status not null default 'pending',
  amount numeric(12,2) not null,
  reference text not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_batch_id on payments(batch_id);

-- ============================================================================
-- 10. DELIVERIES — une livraison par LOT (entrepôt -> client)
-- ============================================================================
create type delivery_status as enum ('assigned', 'picked_up', 'out_for_delivery', 'completed', 'cancelled');

create table if not exists deliveries (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references order_batches(id) on delete cascade,
  courier_id uuid references profiles(id),
  status delivery_status not null default 'assigned',
  courier_lat double precision,
  courier_lng double precision,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_deliveries_batch_id on deliveries(batch_id);
create index if not exists idx_deliveries_courier_id on deliveries(courier_id);

-- ============================================================================
-- 11. WALLETS / WALLET_TRANSACTIONS / SCHEDULED_PAYOUTS
-- ============================================================================
create table if not exists wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0,
  total_sales_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create type wallet_reason as enum ('sale', 'delivery', 'withdrawal', 'adjustment');

create table if not exists wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  order_id uuid references orders(id),
  batch_id uuid references order_batches(id),
  amount numeric(12,2) not null,
  gross_amount numeric(12,2) not null,
  commission_rate numeric(5,2) not null,
  reason wallet_reason not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_transactions_order_id on wallet_transactions(order_id);
create index if not exists idx_wallet_transactions_wallet_id on wallet_transactions(wallet_id);
create index if not exists idx_wallet_transactions_batch_id on wallet_transactions(batch_id);

create type payout_type as enum ('seller', 'courier');
create type payout_status as enum ('pending', 'paid', 'failed');

create table if not exists scheduled_payouts (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,        -- vendeur
  batch_id uuid references order_batches(id) on delete cascade, -- coursier
  payout_type payout_type not null,
  run_at timestamptz not null,
  status payout_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint scheduled_payouts_target_check check (
    (payout_type = 'seller' and order_id is not null and batch_id is null)
    or (payout_type = 'courier' and batch_id is not null and order_id is null)
  ),
  unique (order_id, payout_type),
  unique (batch_id, payout_type)
);

-- ============================================================================
-- 12. PLATFORM_ACCOUNT — compte central Alliance Colis
-- ============================================================================
create table if not exists platform_account (
  id text primary key default 'main',
  balance numeric(14,2) not null default 0,
  total_commission_earned numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 'main')
);
insert into platform_account (id) values ('main') on conflict (id) do nothing;

create or replace function credit_platform_account(p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update platform_account set balance = balance + p_amount, updated_at = now() where id = 'main';
end;
$$;
revoke execute on function credit_platform_account(numeric) from public, anon, authenticated;

-- ============================================================================
-- RLS — activation
-- ============================================================================
alter table profiles enable row level security;
alter table kyc_documents enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table cart enable row level security;
alter table warehouses enable row level security;
alter table order_batches enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table deliveries enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table scheduled_payouts enable row level security;
alter table platform_account enable row level security;

-- SECURITY DEFINER indispensable : sans lui, la requête interne reste soumise
-- à la RLS de "profiles", qui rappelle cette fonction pour chaque ligne
-- évaluée -> récursion infinie -> "stack depth limit exceeded".
-- (bug réel rencontré en production le 2026-07-18, corrigé ce jour-là)
create or replace function current_role_is(target user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = target);
$$;

create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or current_role_is('admin'));
create policy "profiles_update_own_or_admin" on profiles
  for update using (id = auth.uid() or current_role_is('admin'));
create policy "profiles_insert_self" on profiles
  for insert with check (id = auth.uid());

-- Crée automatiquement "profiles" à l'inscription (y compris l'acceptation
-- horodatée des CGU), indépendamment de l'état de session côté client.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, country, role, verified, terms_accepted, terms_accepted_at, terms_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'country', ''),
    'customer', false,
    coalesce((new.raw_user_meta_data->>'terms_accepted')::boolean, false),
    case when (new.raw_user_meta_data->>'terms_accepted')::boolean then now() else null end,
    new.raw_user_meta_data->>'terms_version'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create policy "kyc_select_own_or_admin" on kyc_documents
  for select using (user_id = auth.uid() or current_role_is('admin'));
create policy "kyc_insert_own" on kyc_documents
  for insert with check (user_id = auth.uid());
create policy "kyc_update_admin_only" on kyc_documents
  for update using (current_role_is('admin'));

create policy "shops_select_public_or_owner" on shops
  for select using (status = 'approved' or owner_id = auth.uid() or current_role_is('admin'));
create policy "shops_insert_owner" on shops
  for insert with check (owner_id = auth.uid());
create policy "shops_update_owner_or_admin" on shops
  for update using (owner_id = auth.uid() or current_role_is('admin'));

create policy "products_select_public_or_owner" on products
  for select using (
    (active and approved)
    or exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
    or current_role_is('admin')
  );
create policy "products_insert_owner" on products
  for insert with check (exists (select 1 from shops where shops.id = shop_id and shops.owner_id = auth.uid()));
create policy "products_update_owner_or_admin" on products
  for update using (
    exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
    or current_role_is('admin')
  );

create policy "cart_owner_only" on cart
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "warehouses_select_all" on warehouses for select using (true);
create policy "warehouses_write_admin_only" on warehouses
  for all using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "order_batches_select_involved" on order_batches
  for select using (
    user_id = auth.uid()
    or exists (select 1 from orders o join shops s on s.id = o.shop_id where o.batch_id = order_batches.id and s.owner_id = auth.uid())
    or exists (select 1 from deliveries d where d.batch_id = order_batches.id and d.courier_id = auth.uid())
    or current_role_is('admin')
  );
create policy "order_batches_insert_own" on order_batches for insert with check (user_id = auth.uid());
create policy "order_batches_update_involved" on order_batches
  for update using (user_id = auth.uid() or current_role_is('admin'));

create policy "orders_select_involved" on orders
  for select using (
    user_id = auth.uid()
    or exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
    or exists (select 1 from deliveries d where d.batch_id = orders.batch_id and d.courier_id = auth.uid())
    or current_role_is('admin')
  );
create policy "orders_insert_own" on orders for insert with check (user_id = auth.uid());
create policy "orders_update_involved" on orders
  for update using (
    user_id = auth.uid()
    or exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
    or current_role_is('admin')
  );

create policy "order_items_select_via_order" on order_items
  for select using (
    exists (select 1 from orders where orders.id = order_items.order_id and (
      orders.user_id = auth.uid()
      or exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
      or current_role_is('admin')
    ))
  );
create policy "order_items_insert_own_order" on order_items
  for insert with check (exists (select 1 from orders where orders.id = order_id and orders.user_id = auth.uid()));

create policy "payments_select_own_or_admin" on payments
  for select using (
    exists (select 1 from order_batches where order_batches.id = payments.batch_id and order_batches.user_id = auth.uid())
    or current_role_is('admin')
  );
create policy "payments_insert_own_batch" on payments
  for insert with check (exists (select 1 from order_batches where order_batches.id = batch_id and order_batches.user_id = auth.uid()));

create policy "deliveries_select_involved" on deliveries
  for select using (
    courier_id = auth.uid()
    or exists (select 1 from order_batches where order_batches.id = deliveries.batch_id and order_batches.user_id = auth.uid())
    or exists (select 1 from orders o join shops s on s.id = o.shop_id where o.batch_id = deliveries.batch_id and s.owner_id = auth.uid())
    or current_role_is('admin')
  );
create policy "deliveries_update_courier_or_admin" on deliveries
  for update using (courier_id = auth.uid() or current_role_is('admin'));
create policy "deliveries_insert_admin_or_system" on deliveries
  for insert with check (current_role_is('admin') or courier_id = auth.uid());

create policy "wallets_select_own_or_admin" on wallets
  for select using (user_id = auth.uid() or current_role_is('admin'));
create policy "wallet_tx_select_own_or_admin" on wallet_transactions
  for select using (
    exists (select 1 from wallets where wallets.id = wallet_transactions.wallet_id and wallets.user_id = auth.uid())
    or current_role_is('admin')
  );

create policy "scheduled_payouts_involved_or_admin" on scheduled_payouts
  for select using (
    current_role_is('admin')
    or (payout_type = 'seller' and exists (
      select 1 from orders o join shops s on s.id = o.shop_id
      where o.id = scheduled_payouts.order_id and s.owner_id = auth.uid()
    ))
    or (payout_type = 'courier' and exists (
      select 1 from deliveries d where d.batch_id = scheduled_payouts.batch_id and d.courier_id = auth.uid()
    ))
  );

create policy "platform_account_admin_only" on platform_account
  for select using (current_role_is('admin'));

-- ============================================================================
-- STORAGE — buckets + policies
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('products', 'products', true), ('shops', 'shops', true), ('avatars', 'avatars', true), ('kyc', 'kyc', false)
on conflict (id) do nothing;

-- Buckets publics : pas de policy SELECT nécessaire (l'URL publique suffit à
-- récupérer un fichier ; une policy SELECT permettrait en plus de LISTER tout
-- le contenu du bucket, ce qu'on ne souhaite pas).
create policy "auth_write_products" on storage.objects
  for insert with check (bucket_id = 'products' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth_update_products" on storage.objects
  for update using (bucket_id = 'products' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth_delete_products" on storage.objects
  for delete using (bucket_id = 'products' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "auth_write_shops" on storage.objects
  for insert with check (bucket_id = 'shops' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth_update_shops" on storage.objects
  for update using (bucket_id = 'shops' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "auth_write_avatars" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth_update_avatars" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner_read_kyc" on storage.objects
  for select using (bucket_id = 'kyc' and (auth.uid()::text = (storage.foldername(name))[1] or current_role_is('admin')));
create policy "auth_write_kyc" on storage.objects
  for insert with check (bucket_id = 'kyc' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- TRIGGER : paiement confirmé -> livraison unique créée pour le lot
-- ============================================================================
create or replace function create_delivery_on_batch_confirmation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    insert into deliveries (batch_id, status) values (new.id, 'assigned') on conflict do nothing;
    update orders set status = 'confirmed' where batch_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
revoke execute on function create_delivery_on_batch_confirmation() from public, anon, authenticated;

drop trigger if exists trg_create_delivery_on_batch on order_batches;
create trigger trg_create_delivery_on_batch
  after update on order_batches
  for each row execute function create_delivery_on_batch_confirmation();

-- ============================================================================
-- TRIGGER : livraison terminée -> versements planifiés (vendeur 24h/commande,
-- coursier 10min/lot) + clôture des orders/batch
-- ============================================================================
create or replace function schedule_payouts_on_batch_delivered()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update order_batches set status = 'completed' where id = new.batch_id;
    update orders set status = 'completed' where batch_id = new.batch_id;

    insert into scheduled_payouts (order_id, payout_type, run_at)
      select o.id, 'seller', now() + interval '24 hours' from orders o where o.batch_id = new.batch_id
      on conflict (order_id, payout_type) do nothing;

    if new.courier_id is not null then
      insert into scheduled_payouts (batch_id, payout_type, run_at)
        values (new.batch_id, 'courier', now() + interval '10 minutes')
        on conflict (batch_id, payout_type) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function schedule_payouts_on_batch_delivered() from public, anon, authenticated;

drop trigger if exists trg_schedule_payouts on deliveries;
create trigger trg_schedule_payouts
  after update on deliveries
  for each row execute function schedule_payouts_on_batch_delivered();

-- ============================================================================
-- CRON (toutes les minutes) : verse les paiements dus
-- ============================================================================
create or replace function process_scheduled_payouts()
returns void language plpgsql security definer set search_path = public as $$
declare
  payout record;
  ord orders%rowtype;
  batch order_batches%rowtype;
  seller_id uuid;
  courier_id uuid;
  seller_wallet_id uuid;
  courier_wallet_id uuid;
  sales_count integer;
  commission_rate numeric(5,2);
  net_amount numeric(12,2);
  courier_commission_rate numeric(5,2) := 25.00;
  courier_net numeric(12,2);
begin
  for payout in
    select * from scheduled_payouts where status = 'pending' and run_at <= now() order by run_at asc limit 200
  loop
    if payout.payout_type = 'seller' then
      select * into ord from orders where id = payout.order_id;
      select owner_id into seller_id from shops where id = ord.shop_id;

      insert into wallets (user_id) values (seller_id) on conflict (user_id) do nothing;
      select id, total_sales_count into seller_wallet_id, sales_count from wallets where user_id = seller_id;

      commission_rate := case when sales_count < 10 then 5.00 when sales_count < 25 then 8.00 else 10.00 end;
      net_amount := round(ord.items_total * (1 - commission_rate / 100.0));

      update wallets set balance = balance + net_amount, total_sales_count = total_sales_count + 1, updated_at = now()
        where id = seller_wallet_id;
      insert into wallet_transactions (wallet_id, order_id, amount, gross_amount, commission_rate, reason)
        values (seller_wallet_id, ord.id, net_amount, ord.items_total, commission_rate, 'sale');
      update platform_account set balance = balance - net_amount,
        total_commission_earned = total_commission_earned + (ord.items_total - net_amount), updated_at = now()
        where id = 'main';

    elsif payout.payout_type = 'courier' then
      select * into batch from order_batches where id = payout.batch_id;
      select courier_id into courier_id from deliveries where batch_id = batch.id limit 1;

      if courier_id is not null then
        insert into wallets (user_id) values (courier_id) on conflict (user_id) do nothing;
        select id into courier_wallet_id from wallets where user_id = courier_id;

        courier_net := round(batch.delivery_fee * (1 - courier_commission_rate / 100.0));

        update wallets set balance = balance + courier_net, updated_at = now() where id = courier_wallet_id;
        insert into wallet_transactions (wallet_id, batch_id, amount, gross_amount, commission_rate, reason)
          values (courier_wallet_id, batch.id, courier_net, batch.delivery_fee, courier_commission_rate, 'delivery');
        update platform_account set balance = balance - courier_net,
          total_commission_earned = total_commission_earned + (batch.delivery_fee - courier_net), updated_at = now()
          where id = 'main';
      end if;
    end if;

    update scheduled_payouts set status = 'paid', paid_at = now() where id = payout.id;
  end loop;
end;
$$;
revoke execute on function process_scheduled_payouts() from public, anon, authenticated;

-- Nécessite l'extension pg_cron (Database → Extensions dans le dashboard Supabase).
create extension if not exists pg_cron;
select cron.schedule('process-scheduled-payouts', '* * * * *', $$select process_scheduled_payouts();$$)
where not exists (select 1 from cron.job where jobname = 'process-scheduled-payouts');
