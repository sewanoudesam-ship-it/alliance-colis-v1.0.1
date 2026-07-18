-- ============================================================================
-- ALLIANCE COLIS — SCHEMA V1 PRODUCTION
-- À exécuter dans Supabase SQL editor (une seule fois, sur une base neuve).
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. KYC DOCUMENTS (vendeur / coursier)
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
  shop_name text,               -- rempli seulement si target = seller
  shop_description text,        -- rempli seulement si target = seller
  vehicle_type text,            -- rempli seulement si target = courier
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
  approved boolean not null default false, -- validation admin avant apparition marketplace
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
-- 6. ORDERS / ORDER_ITEMS
-- ============================================================================
create type order_status as enum ('pending', 'confirmed', 'processing', 'completed', 'cancelled');

-- Séquence globale (toutes boutiques confondues) pour numéroter les commandes
-- dans l'ordre chronologique : AC-00000000001, AC-00000000002, ...
create sequence if not exists order_number_seq start 1;

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid not null references shops(id),
  status order_status not null default 'pending',
  items_total numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  delivery_address text not null,
  delivery_lat double precision,
  delivery_lng double precision,
  distance_km numeric(6,2),
  tracking_code text unique,
  payment_session_token text,
  created_at timestamptz not null default now()
);

-- Attribue automatiquement le prochain numéro de commande séquentiel si le
-- code n'est pas déjà fourni à l'insertion (le frontend n'envoie plus de code).
create or replace function set_order_tracking_code()
returns trigger language plpgsql as $$
begin
  if new.tracking_code is null then
    new.tracking_code := 'AC-' || lpad(nextval('order_number_seq')::text, 11, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_order_tracking_code on orders;
create trigger trg_set_order_tracking_code
  before insert on orders
  for each row execute function set_order_tracking_code();

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0)
);

-- ============================================================================
-- 7. PAYMENTS (fictifs pour la V1 — CinetPay / Wave / MTN / Moov / Orange)
-- ============================================================================
create type payment_provider as enum ('cinetpay', 'wave', 'mtn', 'moov', 'orange', 'senepay');
create type payment_status as enum ('pending', 'success', 'failed');

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  provider payment_provider not null,
  status payment_status not null default 'pending',
  amount numeric(12,2) not null,
  reference text not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. DELIVERIES
-- ============================================================================
create type delivery_status as enum ('assigned', 'picked_up', 'out_for_delivery', 'completed', 'cancelled');

create table if not exists deliveries (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  courier_id uuid references profiles(id),
  status delivery_status not null default 'assigned',
  courier_lat double precision,
  courier_lng double precision,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 9. WALLETS / WALLET_TRANSACTIONS
-- ============================================================================
create table if not exists wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0,
  total_sales_count integer not null default 0, -- utilisé pour le palier de commission vendeur
  updated_at timestamptz not null default now()
);

create type wallet_reason as enum ('sale', 'delivery', 'withdrawal', 'adjustment');

create table if not exists wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  order_id uuid references orders(id),
  amount numeric(12,2) not null,       -- montant net crédité (après commission)
  gross_amount numeric(12,2) not null, -- montant brut avant commission
  commission_rate numeric(5,2) not null,
  reason wallet_reason not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_payment_session_token on orders(payment_session_token);

-- ============================================================================
-- RLS — activation
-- ============================================================================
alter table profiles enable row level security;
alter table kyc_documents enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table cart enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table deliveries enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;

-- Fonction utilitaire : rôle de l'utilisateur courant
create or replace function current_role_is(target user_role)
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = target
  );
$$;

-- PROFILES : chacun voit/ømodifie le sien, l'admin voit tout
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or current_role_is('admin'));
create policy "profiles_update_own_or_admin" on profiles
  for update using (id = auth.uid() or current_role_is('admin'));
create policy "profiles_insert_self" on profiles
  for insert with check (id = auth.uid());

-- KYC : le demandeur voit sa demande, l'admin voit tout
create policy "kyc_select_own_or_admin" on kyc_documents
  for select using (user_id = auth.uid() or current_role_is('admin'));
create policy "kyc_insert_own" on kyc_documents
  for insert with check (user_id = auth.uid());
create policy "kyc_update_admin_only" on kyc_documents
  for update using (current_role_is('admin'));

-- SHOPS : lecture publique des boutiques approuvées, gestion par le propriétaire/admin
create policy "shops_select_public_or_owner" on shops
  for select using (status = 'approved' or owner_id = auth.uid() or current_role_is('admin'));
create policy "shops_insert_owner" on shops
  for insert with check (owner_id = auth.uid());
create policy "shops_update_owner_or_admin" on shops
  for update using (owner_id = auth.uid() or current_role_is('admin'));

-- PRODUCTS : lecture publique des produits actifs+validés, gestion par le vendeur propriétaire/admin
create policy "products_select_public_or_owner" on products
  for select using (
    (active and approved)
    or exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
    or current_role_is('admin')
  );
create policy "products_insert_owner" on products
  for insert with check (
    exists (select 1 from shops where shops.id = shop_id and shops.owner_id = auth.uid())
  );
create policy "products_update_owner_or_admin" on products
  for update using (
    exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
    or current_role_is('admin')
  );

-- CART : privé à l'utilisateur
create policy "cart_owner_only" on cart
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ORDERS : client propriétaire, vendeur concerné, coursier assigné, admin
create policy "orders_select_involved" on orders
  for select using (
    user_id = auth.uid()
    or exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
    or exists (select 1 from deliveries d where d.order_id = orders.id and d.courier_id = auth.uid())
    or current_role_is('admin')
  );
create policy "orders_insert_own" on orders
  for insert with check (user_id = auth.uid());
create policy "orders_update_involved" on orders
  for update using (
    user_id = auth.uid()
    or exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
    or current_role_is('admin')
  );

-- ORDER_ITEMS : hérite de la visibilité de la commande
create policy "order_items_select_via_order" on order_items
  for select using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and (
          orders.user_id = auth.uid()
          or exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
          or current_role_is('admin')
        )
    )
  );
create policy "order_items_insert_own_order" on order_items
  for insert with check (
    exists (select 1 from orders where orders.id = order_id and orders.user_id = auth.uid())
  );

-- PAYMENTS : visible par le client de la commande + admin
create policy "payments_select_own_or_admin" on payments
  for select using (
    exists (select 1 from orders where orders.id = payments.order_id and orders.user_id = auth.uid())
    or current_role_is('admin')
  );
create policy "payments_insert_own_order" on payments
  for insert with check (
    exists (select 1 from orders where orders.id = order_id and orders.user_id = auth.uid())
  );

-- DELIVERIES : coursier assigné, client de la commande, admin
create policy "deliveries_select_involved" on deliveries
  for select using (
    courier_id = auth.uid()
    or exists (select 1 from orders where orders.id = deliveries.order_id and orders.user_id = auth.uid())
    or current_role_is('admin')
  );
create policy "deliveries_update_courier_or_admin" on deliveries
  for update using (courier_id = auth.uid() or current_role_is('admin'));
create policy "deliveries_insert_admin_or_system" on deliveries
  for insert with check (current_role_is('admin') or courier_id = auth.uid());

-- WALLETS : uniquement le titulaire + admin
create policy "wallets_select_own_or_admin" on wallets
  for select using (user_id = auth.uid() or current_role_is('admin'));
create policy "wallet_tx_select_own_or_admin" on wallet_transactions
  for select using (
    exists (select 1 from wallets where wallets.id = wallet_transactions.wallet_id and wallets.user_id = auth.uid())
    or current_role_is('admin')
  );

-- ============================================================================
-- TRIGGER : créer automatiquement une livraison "assignable" quand une commande
-- passe à "confirmed" (paiement réussi) — elle apparaît alors dans les missions
-- disponibles des coursiers.
-- ============================================================================
create or replace function create_delivery_on_confirmation()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    insert into deliveries (order_id, status)
      values (new.id, 'assigned')
      on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_delivery on orders;
create trigger trg_create_delivery
  after update on orders
  for each row execute function create_delivery_on_confirmation();

-- ============================================================================
-- STORAGE — buckets + policies (upload réel photos produits/boutiques/avatars/KYC)
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('products', 'products', true),
  ('shops', 'shops', true),
  ('avatars', 'avatars', true),
  ('kyc', 'kyc', false)
on conflict (id) do nothing;

-- products / shops / avatars : lecture publique, écriture par le propriétaire authentifié
-- (convention de chemin : {user_id}/{fichier}, vérifiée via le 1er segment du path)
create policy "public_read_products" on storage.objects
  for select using (bucket_id = 'products');
create policy "auth_write_products" on storage.objects
  for insert with check (bucket_id = 'products' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth_update_products" on storage.objects
  for update using (bucket_id = 'products' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth_delete_products" on storage.objects
  for delete using (bucket_id = 'products' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "public_read_shops" on storage.objects
  for select using (bucket_id = 'shops');
create policy "auth_write_shops" on storage.objects
  for insert with check (bucket_id = 'shops' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth_update_shops" on storage.objects
  for update using (bucket_id = 'shops' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "public_read_avatars" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "auth_write_avatars" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth_update_avatars" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- kyc : privé — seul le propriétaire du document et les admins peuvent le lire ;
-- seul le propriétaire peut l'écrire.
create policy "owner_read_kyc" on storage.objects
  for select using (
    bucket_id = 'kyc'
    and (auth.uid()::text = (storage.foldername(name))[1] or current_role_is('admin'))
  );
create policy "auth_write_kyc" on storage.objects
  for insert with check (bucket_id = 'kyc' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- COMPTE CENTRAL ALLIANCE COLIS
-- Tout paiement client (prix produits + frais de livraison) atterrit d'abord ici
-- (voir senepay-webhook). Les parts vendeur/coursier en sont ensuite débitées de
-- façon différée (24h / 10min) — le solde de ce compte représente la trésorerie
-- de la plateforme, et son cumul de commissions retenues le revenu net généré.
-- ============================================================================
create table if not exists platform_account (
  id text primary key default 'main',
  balance numeric(14,2) not null default 0,
  total_commission_earned numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 'main')
);
insert into platform_account (id) values ('main') on conflict (id) do nothing;

alter table platform_account enable row level security;
create policy "platform_account_admin_only" on platform_account
  for select using (current_role_is('admin'));

/** Crédite le compte central Alliance Colis (appelé par le webhook de paiement). */
create or replace function credit_platform_account(p_amount numeric)
returns void language plpgsql security definer as $$
begin
  update platform_account set balance = balance + p_amount, updated_at = now() where id = 'main';
end;
$$;

-- ============================================================================
-- PAIEMENTS DIFFÉRÉS — planification des versements vendeur (24h) et coursier (10min)
-- ============================================================================
create type payout_type as enum ('seller', 'courier');
create type payout_status as enum ('pending', 'paid', 'failed');

create table if not exists scheduled_payouts (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  payout_type payout_type not null,
  run_at timestamptz not null,
  status payout_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (order_id, payout_type)
);

alter table scheduled_payouts enable row level security;
create policy "scheduled_payouts_involved_or_admin" on scheduled_payouts
  for select using (
    current_role_is('admin')
    or (
      payout_type = 'seller'
      and exists (
        select 1 from orders o join shops s on s.id = o.shop_id
        where o.id = scheduled_payouts.order_id and s.owner_id = auth.uid()
      )
    )
    or (
      payout_type = 'courier'
      and exists (
        select 1 from deliveries d
        where d.order_id = scheduled_payouts.order_id and d.courier_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- TRIGGER : à la livraison terminée, on NE crédite plus rien immédiatement —
-- on planifie les deux versements (règle métier : coursier 10min, vendeur 24h).
-- ============================================================================
create or replace function schedule_payouts_on_delivery_completed()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    insert into scheduled_payouts (order_id, payout_type, run_at)
      values (new.order_id, 'seller', now() + interval '24 hours')
      on conflict (order_id, payout_type) do nothing;

    if new.courier_id is not null then
      insert into scheduled_payouts (order_id, payout_type, run_at)
        values (new.order_id, 'courier', now() + interval '10 minutes')
        on conflict (order_id, payout_type) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_payouts on deliveries;
create trigger trg_schedule_payouts
  after update on deliveries
  for each row execute function schedule_payouts_on_delivery_completed();

-- ============================================================================
-- FONCTION EXÉCUTÉE PAR pg_cron TOUTES LES MINUTES : verse les paiements dus.
--   - Vendeur : (prix total des produits de la commande) × (1 − commission
--     Alliance Colis selon le palier de ventes cumulées de la boutique : 5% / 8% / 10%).
--   - Coursier : 75% du prix de la livraison (les 25% restent acquis à Alliance Colis).
--   - Dans les deux cas, le montant net est débité du compte central platform_account
--     (qui a reçu le montant brut total au moment du paiement client) et crédité
--     sur le wallet du bénéficiaire, avec une ligne dans wallet_transactions.
-- ============================================================================
create or replace function process_scheduled_payouts()
returns void language plpgsql security definer as $$
declare
  payout record;
  ord orders%rowtype;
  seller_id uuid;
  courier_id uuid;
  seller_wallet_id uuid;
  courier_wallet_id uuid;
  sales_count integer;
  commission_rate numeric(5,2);
  net_amount numeric(12,2);
  courier_commission_rate numeric(5,2) := 25.00; -- part Alliance Colis sur la livraison
  courier_net numeric(12,2);
begin
  for payout in
    select * from scheduled_payouts
    where status = 'pending' and run_at <= now()
    order by run_at asc
    limit 200
  loop
    select * into ord from orders where id = payout.order_id;

    if payout.payout_type = 'seller' then
      select owner_id into seller_id from shops where id = ord.shop_id;

      insert into wallets (user_id) values (seller_id) on conflict (user_id) do nothing;
      select id, total_sales_count into seller_wallet_id, sales_count
        from wallets where user_id = seller_id;

      commission_rate := case
        when sales_count < 10 then 5.00
        when sales_count < 25 then 8.00
        else 10.00
      end;
      -- "produits décaissés" : le total des produits de CETTE commande, propres à cette boutique.
      net_amount := round(ord.items_total * (1 - commission_rate / 100.0));

      update wallets set
        balance = balance + net_amount,
        total_sales_count = total_sales_count + 1,
        updated_at = now()
        where id = seller_wallet_id;

      insert into wallet_transactions (wallet_id, order_id, amount, gross_amount, commission_rate, reason)
        values (seller_wallet_id, ord.id, net_amount, ord.items_total, commission_rate, 'sale');

      update platform_account set
        balance = balance - net_amount,
        total_commission_earned = total_commission_earned + (ord.items_total - net_amount),
        updated_at = now()
        where id = 'main';

    elsif payout.payout_type = 'courier' then
      select courier_id into courier_id from deliveries where order_id = ord.id limit 1;

      if courier_id is not null then
        insert into wallets (user_id) values (courier_id) on conflict (user_id) do nothing;
        select id into courier_wallet_id from wallets where user_id = courier_id;

        courier_net := round(ord.delivery_fee * (1 - courier_commission_rate / 100.0)); -- 75% coursier

        update wallets set balance = balance + courier_net, updated_at = now()
          where id = courier_wallet_id;

        insert into wallet_transactions (wallet_id, order_id, amount, gross_amount, commission_rate, reason)
          values (courier_wallet_id, ord.id, courier_net, ord.delivery_fee, courier_commission_rate, 'delivery');

        update platform_account set
          balance = balance - courier_net,
          total_commission_earned = total_commission_earned + (ord.delivery_fee - courier_net),
          updated_at = now()
          where id = 'main';
      end if;
    end if;

    update scheduled_payouts set status = 'paid', paid_at = now() where id = payout.id;
  end loop;
end;
$$;

-- Planification : nécessite l'extension pg_cron (Database → Extensions dans le
-- dashboard Supabase, ou `create extension if not exists pg_cron;` si autorisé
-- sur votre plan). Exécute le versement des paiements dus toutes les minutes.
create extension if not exists pg_cron;
select cron.schedule(
  'process-scheduled-payouts',
  '* * * * *',
  $$select process_scheduled_payouts();$$
) where not exists (
  select 1 from cron.job where jobname = 'process-scheduled-payouts'
);



