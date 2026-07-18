import { supabase } from "../lib/supabase";
import type { Shop, ShopStatus } from "../types";

export async function getShopByOwner(ownerId: string): Promise<Shop | null> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) {
    console.error("getShopByOwner:", error.message);
    return null;
  }
  return data;
}

export async function createShop(payload: {
  owner_id: string;
  name: string;
  description?: string;
  logo_url?: string;
  shop_lat?: number;
  shop_lng?: number;
}): Promise<{ success: boolean; error?: string; shop?: Shop }> {
  const { data, error } = await supabase
    .from("shops")
    .insert({ ...payload, status: "pending" })
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, shop: data };
}

/** Admin : liste les boutiques (filtrable par statut). */
export async function listShops(status?: ShopStatus): Promise<Shop[]> {
  let query = supabase.from("shops").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) {
    console.error("listShops:", error.message);
    return [];
  }
  return data ?? [];
}

export async function setShopStatus(shopId: string, status: ShopStatus): Promise<boolean> {
  const { error } = await supabase.from("shops").update({ status }).eq("id", shopId);
  if (error) {
    console.error("setShopStatus:", error.message);
    return false;
  }
  return true;
}
