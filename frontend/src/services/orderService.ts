import { supabase } from "../lib/supabase";
import type { CartItem, Order, OrderBatch, OrderStatus, LocationSource } from "../types";
import { calculateDeliveryFee } from "../utils/pricing";

export type CheckoutResult = {
  success: boolean;
  batch?: OrderBatch;
  error?: string;
};

/**
 * Crée UN lot de livraison (order_batches) pour tout le panier, quelle que
 * soit le nombre de boutiques concernées, plus une "order" d'exécution par
 * boutique (pour que chaque vendeur prépare sa part). La tarification et le
 * suivi se font au niveau du lot : le client ne paie et ne suit qu'UNE seule
 * livraison, même si son panier vient de plusieurs boutiques (regroupement
 * via l'entrepôt Alliance Colis).
 */
export async function createBatchFromCart(
  userId: string,
  cartItems: CartItem[],
  warehouseId: string,
  deliveryAddress: string,
  locationSource: LocationSource,
  deliveryLat: number | null,
  deliveryLng: number | null,
  distanceKm: number | null
): Promise<CheckoutResult> {
  if (cartItems.length === 0) {
    return { success: false, error: "Le panier est vide." };
  }

  const itemsTotal = cartItems.reduce((sum, i) => sum + (i.products?.price ?? 0) * i.quantity, 0);
  // Sans distance confirmée (pas de GPS, adresse seule), on applique le tarif
  // plancher en attendant qu'un administrateur confirme la distance réelle
  // (voir location_source = 'address' -> 'manual_confirmation').
  const deliveryFee = distanceKm != null ? calculateDeliveryFee(distanceKm) : calculateDeliveryFee(0);

  const { data: batch, error: batchError } = await supabase
    .from("order_batches")
    .insert({
      user_id: userId,
      warehouse_id: warehouseId,
      status: "pending",
      items_total: itemsTotal,
      delivery_fee: deliveryFee,
      total_price: itemsTotal + deliveryFee,
      delivery_address: deliveryAddress,
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
      location_source: locationSource,
      distance_km: distanceKm,
    })
    .select()
    .single();

  if (batchError || !batch) {
    return { success: false, error: batchError?.message ?? "Erreur lors de la création de la commande." };
  }

  const byShop = new Map<string, CartItem[]>();
  for (const item of cartItems) {
    const shopId = item.products?.shop_id;
    if (!shopId) continue;
    if (!byShop.has(shopId)) byShop.set(shopId, []);
    byShop.get(shopId)!.push(item);
  }

  for (const [shopId, items] of byShop.entries()) {
    const shopItemsTotal = items.reduce((sum, i) => sum + (i.products?.price ?? 0) * i.quantity, 0);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ batch_id: batch.id, user_id: userId, shop_id: shopId, items_total: shopItemsTotal, status: "pending" })
      .select()
      .single();

    if (orderError || !order) {
      return { success: false, error: orderError?.message };
    }

    const orderItemsPayload = items.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.products?.name ?? "Produit",
      unit_price: i.products?.price ?? 0,
      quantity: i.quantity,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);
    if (itemsError) {
      return { success: false, error: itemsError.message };
    }
  }

  return { success: true, batch };
}

export async function listCustomerBatches(userId: string): Promise<OrderBatch[]> {
  const { data, error } = await supabase
    .from("order_batches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listCustomerBatches:", error.message);
    return [];
  }
  return data ?? [];
}

/** Commandes reçues par une boutique (une ligne par lot client concerné). */
export async function listShopOrders(shopId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listShopOrders:", error.message);
    return [];
  }
  return data ?? [];
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  return !error;
}

export async function getBatchByTrackingCode(code: string): Promise<OrderBatch | null> {
  const { data, error } = await supabase
    .from("order_batches")
    .select("*")
    .eq("tracking_code", code)
    .maybeSingle();
  if (error) {
    console.error("getBatchByTrackingCode:", error.message);
    return null;
  }
  return data;
}

/** Admin : vue globale de tous les lots de livraison. */
export async function listAllBatches(): Promise<OrderBatch[]> {
  const { data, error } = await supabase
    .from("order_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listAllBatches:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Admin : lots payés, dont TOUTES les boutiques ont confirmé leur part, sans
 * livraison encore créée -> prêts à être assignés à un coursier.
 */
export async function listBatchesReadyForDispatch(): Promise<OrderBatch[]> {
  const { data, error } = await supabase
    .from("batches_ready_for_dispatch")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listBatchesReadyForDispatch:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Admin : valide un lot prêt et l'assigne explicitement à un coursier (plus
 * de "missions disponibles" en libre-service — le coursier reçoit
 * directement la mission). La position initiale du coursier est celle de
 * l'entrepôt, pour que le calcul de distance/suivi soit cohérent dès le
 * départ, avant sa première position GPS réelle.
 */
export async function dispatchBatch(
  batchId: string,
  courierId: string,
  warehouseLat: number,
  warehouseLng: number
): Promise<{ success: boolean; error?: string }> {
  const { error: deliveryError } = await supabase.from("deliveries").insert({
    batch_id: batchId,
    courier_id: courierId,
    status: "assigned",
    courier_lat: warehouseLat,
    courier_lng: warehouseLng,
    accepted_at: new Date().toISOString(),
  });
  if (deliveryError) return { success: false, error: deliveryError.message };

  const { error: batchError } = await supabase
    .from("order_batches")
    .update({ status: "processing" })
    .eq("id", batchId);
  if (batchError) return { success: false, error: batchError.message };

  return { success: true };
}

/** Admin : corrige la distance d'un lot sans GPS, recalcule le tarif, et
 * marque la localisation comme confirmée manuellement. */
export async function confirmBatchDistance(batchId: string, distanceKm: number): Promise<boolean> {
  const deliveryFee = calculateDeliveryFee(distanceKm);
  const { data: batch } = await supabase.from("order_batches").select("items_total").eq("id", batchId).single();
  if (!batch) return false;
  const { error } = await supabase
    .from("order_batches")
    .update({
      distance_km: distanceKm,
      delivery_fee: deliveryFee,
      total_price: batch.items_total + deliveryFee,
      location_source: "manual_confirmation",
    })
    .eq("id", batchId);
  return !error;
}
