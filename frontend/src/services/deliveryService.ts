import { supabase } from "../lib/supabase";
import type { Delivery, DeliveryStatus } from "../types";

/** Missions disponibles : commandes confirmées/en préparation sans coursier assigné. */
export async function listAvailableMissions(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(*)")
    .is("courier_id", null)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listAvailableMissions:", error.message);
    return [];
  }
  return data ?? [];
}

export async function listCourierMissions(courierId: string): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(*)")
    .eq("courier_id", courierId)
    .in("status", ["assigned", "picked_up", "out_for_delivery"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listCourierMissions:", error.message);
    return [];
  }
  return data ?? [];
}

export async function listCourierHistory(courierId: string): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(*)")
    .eq("courier_id", courierId)
    .in("status", ["completed", "cancelled"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listCourierHistory:", error.message);
    return [];
  }
  return data ?? [];
}

export async function acceptMission(deliveryId: string, courierId: string): Promise<boolean> {
  const { error } = await supabase
    .from("deliveries")
    .update({ courier_id: courierId, accepted_at: new Date().toISOString() })
    .eq("id", deliveryId)
    .is("courier_id", null); // évite qu'un autre coursier ne l'accepte en même temps
  return !error;
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus
): Promise<boolean> {
  const patch: Record<string, unknown> = { status };
  if (status === "picked_up") patch.picked_up_at = new Date().toISOString();
  if (status === "completed") patch.completed_at = new Date().toISOString();

  const { error } = await supabase.from("deliveries").update(patch).eq("id", deliveryId);
  if (error) return false;

  // Quand la livraison est terminée, on synchronise le statut de la commande
  // (le trigger SQL credit_wallets_on_completion() créditera alors les wallets).
  if (status === "completed") {
    const { data: delivery } = await supabase
      .from("deliveries")
      .select("order_id")
      .eq("id", deliveryId)
      .single();
    if (delivery) {
      await supabase.from("orders").update({ status: "completed" }).eq("id", delivery.order_id);
    }
  }
  return true;
}

export async function updateCourierPosition(
  deliveryId: string,
  lat: number,
  lng: number
): Promise<boolean> {
  const { error } = await supabase
    .from("deliveries")
    .update({ courier_lat: lat, courier_lng: lng })
    .eq("id", deliveryId);
  return !error;
}

/** Suivi client : récupère la livraison liée à une commande. */
export async function getDeliveryByOrder(orderId: string): Promise<Delivery | null> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(*)")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) {
    console.error("getDeliveryByOrder:", error.message);
    return null;
  }
  return data;
}

/** Admin : vue de supervision de toutes les livraisons en cours. */
export async function listAllActiveDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(*)")
    .in("status", ["assigned", "picked_up", "out_for_delivery"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listAllActiveDeliveries:", error.message);
    return [];
  }
  return data ?? [];
}
