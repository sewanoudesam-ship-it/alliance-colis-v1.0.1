import { supabase } from "../lib/supabase";
import type { Warehouse } from "../types";

/** Entrepôt actif servant de point de départ à toutes les livraisons (V1.0.1 : un seul). */
export async function getActiveWarehouse(): Promise<Warehouse | null> {
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getActiveWarehouse:", error.message);
    return null;
  }
  return data;
}

/** Admin : liste tous les entrepôts (actifs et inactifs). */
export async function listWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await supabase.from("warehouses").select("*").order("created_at");
  if (error) {
    console.error("listWarehouses:", error.message);
    return [];
  }
  return data ?? [];
}

/** Admin : corrige les coordonnées/adresse de l'entrepôt. */
export async function updateWarehouse(
  id: string,
  patch: { name?: string; address?: string; warehouse_lat?: number; warehouse_lng?: number }
): Promise<boolean> {
  const { error } = await supabase.from("warehouses").update(patch).eq("id", id);
  return !error;
}
