import { supabase } from "../lib/supabase";
import type { CartItem, Order, OrderStatus } from "../types";
import { calculateDeliveryFee } from "../utils/pricing";

export type CheckoutResult = {
  success: boolean;
  orders: Order[];
  error?: string;
};

/**
 * Crée une commande par boutique à partir du panier (un panier peut contenir des
 * produits de plusieurs boutiques : chaque boutique donne lieu à une commande et
 * une livraison distinctes, comme sur les marketplaces multi-vendeurs classiques).
 */
export async function createOrdersFromCart(
  userId: string,
  cartItems: CartItem[],
  deliveryAddress: string,
  deliveryLat: number,
  deliveryLng: number,
  distanceByShop: Map<string, number>
): Promise<CheckoutResult> {
  if (cartItems.length === 0) {
    return { success: false, orders: [], error: "Le panier est vide." };
  }

  const byShop = new Map<string, CartItem[]>();
  for (const item of cartItems) {
    const shopId = item.products?.shop_id;
    if (!shopId) continue;
    if (!byShop.has(shopId)) byShop.set(shopId, []);
    byShop.get(shopId)!.push(item);
  }

  const createdOrders: Order[] = [];

  for (const [shopId, items] of byShop.entries()) {
    const distanceKm = distanceByShop.get(shopId) ?? 0;
    const deliveryFee = calculateDeliveryFee(distanceKm);
    const itemsTotal = items.reduce(
      (sum, i) => sum + (i.products?.price ?? 0) * i.quantity,
      0
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        shop_id: shopId,
        status: "pending",
        items_total: itemsTotal,
        delivery_fee: deliveryFee,
        total_price: itemsTotal + deliveryFee,
        delivery_address: deliveryAddress,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        distance_km: distanceKm,
        // tracking_code n'est plus fourni ici : la base l'attribue automatiquement
        // de façon séquentielle (AC-00000000001, AC-00000000002, ...).
      })
      .select()
      .single();

    if (orderError || !order) {
      return { success: false, orders: createdOrders, error: orderError?.message };
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
      return { success: false, orders: createdOrders, error: itemsError.message };
    }

    createdOrders.push(order);
  }

  return { success: true, orders: createdOrders };
}

export async function listCustomerOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listCustomerOrders:", error.message);
    return [];
  }
  return data ?? [];
}

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

export async function getOrderByTrackingCode(code: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tracking_code", code)
    .maybeSingle();
  if (error) {
    console.error("getOrderByTrackingCode:", error.message);
    return null;
  }
  return data;
}

/** Admin : vue globale de toutes les commandes. */
export async function listAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listAllOrders:", error.message);
    return [];
  }
  return data ?? [];
}
