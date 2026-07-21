/**
 * Source unique de vérité pour tous les types partagés de l'application.
 * Ces types reflètent le schéma Supabase défini dans /supabase/schema.sql.
 * Ne jamais redéfinir ces types localement dans un composant.
 */

export type UserRole =
  | "customer"
  | "seller_pending"
  | "seller"
  | "courier_pending"
  | "courier"
  | "admin";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  role: UserRole;
  verified: boolean;
  avatar_url?: string | null;
  terms_accepted: boolean;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  created_at: string;
};

export type TabType = "home" | "market" | "cart" | "tracking";

export type KycTarget = "seller" | "courier";
export type KycStatus = "pending" | "approved" | "rejected";

export type KycDocument = {
  id: string;
  user_id: string;
  target: KycTarget;
  full_name: string;
  phone: string;
  id_document_url: string;
  shop_name?: string | null;
  shop_description?: string | null;
  vehicle_type?: string | null;
  status: KycStatus;
  admin_comment?: string | null;
  created_at: string;
};

export type ShopStatus = "pending" | "approved" | "blocked";

export type Shop = {
  id: string;
  owner_id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  shop_lat?: number | null;
  shop_lng?: number | null;
  status: ShopStatus;
  created_at: string;
};

export type Product = {
  id: string;
  shop_id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  photo_url?: string | null;
  active: boolean;
  approved: boolean;
  created_at: string;
  shops?: { name: string } | null;
};

export type CartItem = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  products?: Product | null;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "completed"
  | "cancelled";

export type Warehouse = {
  id: string;
  name: string;
  address: string;
  warehouse_lat: number;
  warehouse_lng: number;
  active: boolean;
  created_at: string;
};

export type LocationSource = "gps" | "address" | "manual_confirmation";

/**
 * Le LOT facturé et livré au client (une seule livraison, même si son panier
 * contient plusieurs boutiques). Porte la tarification, la géolocalisation,
 * le code de suivi et le paiement.
 */
export type OrderBatch = {
  id: string;
  user_id: string;
  warehouse_id: string;
  status: OrderStatus;
  items_total: number;
  delivery_fee: number;
  total_price: number;
  delivery_address: string;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  location_source: LocationSource;
  distance_km?: number | null;
  tracking_code: string;
  payment_session_token?: string | null;
  created_at: string;
};

/** Une ligne d'exécution par boutique au sein d'un lot (pour le vendeur). */
export type Order = {
  id: string;
  batch_id: string;
  user_id: string;
  shop_id: string;
  status: OrderStatus;
  items_total: number;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
};

export type PaymentProvider = "cinetpay" | "wave" | "mtn" | "moov" | "orange" | "senepay";
export type PaymentStatus = "pending" | "success" | "failed";

export type Payment = {
  id: string;
  batch_id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  reference: string;
  created_at: string;
};

export type DeliveryStatus =
  | "assigned"
  | "picked_up"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type Delivery = {
  id: string;
  batch_id: string;
  courier_id?: string | null;
  status: DeliveryStatus;
  courier_lat?: number | null;
  courier_lng?: number | null;
  accepted_at?: string | null;
  picked_up_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  order_batches?: OrderBatch | null;
};

export type Wallet = {
  id: string;
  user_id: string;
  balance: number;
  total_sales_count: number;
  updated_at: string;
};

export type PayoutType = "seller" | "courier";
export type PayoutStatus = "pending" | "paid" | "failed";

export type ScheduledPayout = {
  id: string;
  order_id?: string | null;
  batch_id?: string | null;
  payout_type: PayoutType;
  run_at: string;
  status: PayoutStatus;
  paid_at?: string | null;
  orders?: { items_total: number } | null;
  order_batches?: { tracking_code: string; delivery_fee: number } | null;
};

export type PlatformAccount = {
  id: "main";
  balance: number;
  total_commission_earned: number;
  updated_at: string;
};

export type Country = {
  code: string;
  name: string;
  prefix: string;
};
