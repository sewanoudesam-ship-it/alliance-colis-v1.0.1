import { supabase } from "../lib/supabase";
import type { Wallet, ScheduledPayout, PlatformAccount } from "../types";
import { getSellerCommissionRate } from "../utils/pricing";

export type WalletTransaction = {
  id: string;
  amount: number;
  gross_amount: number;
  commission_rate: number;
  reason: "sale" | "delivery" | "withdrawal" | "adjustment";
  created_at: string;
};

export async function getWallet(userId: string): Promise<Wallet | null> {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getWallet:", error.message);
    return null;
  }
  // Aucun wallet tant qu'aucune vente/livraison n'a encore été créditée.
  return data ?? { id: "", user_id: userId, balance: 0, total_sales_count: 0, updated_at: "" };
}

export async function listWalletTransactions(walletId: string): Promise<WalletTransaction[]> {
  if (!walletId) return [];
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("listWalletTransactions:", error.message);
    return [];
  }
  return data ?? [];
}

/** Taux de commission actuel du vendeur, calculé depuis son wallet. */
export function currentSellerCommissionRate(wallet: Wallet | null): number {
  return getSellerCommissionRate(wallet?.total_sales_count ?? 0);
}

/**
 * Versements planifiés mais pas encore payés (RLS : le vendeur/coursier ne voit
 * que les siens). "seller" -> crédité 24h après livraison terminée,
 * "courier" -> crédité 10 minutes après livraison terminée.
 */
export async function listPendingPayouts(type: "seller" | "courier"): Promise<ScheduledPayout[]> {
  const selectClause = type === "seller" ? "*, orders(items_total)" : "*, order_batches(tracking_code, delivery_fee)";
  const { data, error } = await supabase
    .from("scheduled_payouts")
    .select(selectClause)
    .eq("payout_type", type)
    .eq("status", "pending")
    .order("run_at", { ascending: true });
  if (error) {
    console.error("listPendingPayouts:", error.message);
    return [];
  }
  return (data as unknown as ScheduledPayout[]) ?? [];
}

/** Admin uniquement (RLS) : solde et revenu cumulé du compte central Alliance Colis. */
export async function getPlatformAccount(): Promise<PlatformAccount | null> {
  const { data, error } = await supabase.from("platform_account").select("*").eq("id", "main").maybeSingle();
  if (error) {
    console.error("getPlatformAccount:", error.message);
    return null;
  }
  return data;
}
