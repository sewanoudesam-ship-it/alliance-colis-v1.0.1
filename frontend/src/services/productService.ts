import { supabase } from "../lib/supabase";
import type { Product } from "../types";

/** Marketplace client : produits actifs + validés, avec le nom de la boutique. */
export async function listMarketplaceProducts(search?: string): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*, shops(name)")
    .eq("active", true)
    .eq("approved", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false });

  if (search && search.trim().length > 0) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listMarketplaceProducts:", error.message);
    return [];
  }
  return data ?? [];
}

export async function listShopProducts(shopId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listShopProducts:", error.message);
    return [];
  }
  return data ?? [];
}

export async function createProduct(payload: {
  shop_id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  photo_url?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("products").insert(payload);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleProductActive(productId: string, active: boolean): Promise<boolean> {
  const { error } = await supabase.from("products").update({ active }).eq("id", productId);
  return !error;
}

export async function deleteProduct(productId: string): Promise<boolean> {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  return !error;
}

/** Admin : produits en attente de validation avant apparition sur le marketplace. */
export async function listPendingProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, shops(name)")
    .eq("approved", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listPendingProducts:", error.message);
    return [];
  }
  return data ?? [];
}

export async function approveProduct(productId: string): Promise<boolean> {
  const { error } = await supabase.from("products").update({ approved: true }).eq("id", productId);
  return !error;
}
