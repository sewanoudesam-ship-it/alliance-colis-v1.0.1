import { supabase } from "../lib/supabase";
import type { CartItem } from "../types";

export async function getCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart")
    .select("*, products(*, shops(name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getCart:", error.message);
    return [];
  }
  return data ?? [];
}

/** Ajoute un produit au panier, ou incrémente la quantité s'il y est déjà. */
export async function addToCart(userId: string, productId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from("cart")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("cart")
      .update({ quantity: existing.quantity + 1 })
      .eq("id", existing.id);
    return !error;
  }

  const { error } = await supabase
    .from("cart")
    .insert({ user_id: userId, product_id: productId, quantity: 1 });
  return !error;
}

export async function updateCartQuantity(cartItemId: string, quantity: number): Promise<boolean> {
  if (quantity <= 0) return removeFromCart(cartItemId);
  const { error } = await supabase.from("cart").update({ quantity }).eq("id", cartItemId);
  return !error;
}

export async function removeFromCart(cartItemId: string): Promise<boolean> {
  const { error } = await supabase.from("cart").delete().eq("id", cartItemId);
  return !error;
}

export async function clearCart(userId: string): Promise<boolean> {
  const { error } = await supabase.from("cart").delete().eq("user_id", userId);
  return !error;
}
