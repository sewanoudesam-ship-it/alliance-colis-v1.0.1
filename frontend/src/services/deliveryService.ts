import { supabase } from "../lib/supabase";
import type { Delivery, DeliveryStatus } from "../types";

export async function listCourierMissions(courierId: string): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, order_batches(*)")
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
    .select("*, order_batches(*)")
    .eq("courier_id", courierId)
    .in("status", ["completed", "cancelled"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listCourierHistory:", error.message);
    return [];
  }
  return data ?? [];
}

export async function updateDeliveryStatus(deliveryId: string, status: DeliveryStatus): Promise<boolean> {
  const patch: Record<string, unknown> = { status };
  if (status === "picked_up") patch.picked_up_at = new Date().toISOString();
  if (status === "completed") patch.completed_at = new Date().toISOString();

  // Le passage à "completed" déclenche le trigger SQL qui planifie les
  // versements (vendeur 24h / coursier 10min) et clôt le lot + les commandes.
  const { error } = await supabase.from("deliveries").update(patch).eq("id", deliveryId);
  return !error;
}

export async function updateCourierPosition(deliveryId: string, lat: number, lng: number): Promise<boolean> {
  const { error } = await supabase.from("deliveries").update({ courier_lat: lat, courier_lng: lng }).eq("id", deliveryId);
  return !error;
}

/** Suivi client : récupère la livraison liée à un lot. */
export async function getDeliveryByBatch(batchId: string): Promise<Delivery | null> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, order_batches(*)")
    .eq("batch_id", batchId)
    .maybeSingle();
  if (error) {
    console.error("getDeliveryByBatch:", error.message);
    return null;
  }
  return data;
}

/** Admin : vue de supervision de toutes les livraisons en cours. */
export async function listAllActiveDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, order_batches(*)")
    .in("status", ["assigned", "picked_up", "out_for_delivery"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listAllActiveDeliveries:", error.message);
    return [];
  }
  return data ?? [];
}
