import { supabase } from "../lib/supabase";
import type { KycDocument, KycTarget, KycStatus } from "../types";

export async function submitKyc(payload: {
  user_id: string;
  target: KycTarget;
  full_name: string;
  phone: string;
  id_document_url: string;
  shop_name?: string;
  shop_description?: string;
  vehicle_type?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("kyc_documents").insert(payload);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Admin : liste les demandes KYC (par défaut celles en attente). */
export async function listKyc(status: KycStatus = "pending"): Promise<KycDocument[]> {
  const { data, error } = await supabase
    .from("kyc_documents")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listKyc:", error.message);
    return [];
  }
  return data ?? [];
}

/** Admin : approuve une demande KYC. Fait passer le profil vendeur/coursier en rôle actif
 *  et crée automatiquement la boutique en attente si c'est une demande vendeur. */
export async function approveKyc(doc: KycDocument): Promise<{ success: boolean; error?: string }> {
  const { error: kycError } = await supabase
    .from("kyc_documents")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", doc.id);
  if (kycError) return { success: false, error: kycError.message };

  const newRole = doc.target === "seller" ? "seller" : "courier";
  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: newRole, verified: true })
    .eq("id", doc.user_id);
  if (roleError) return { success: false, error: roleError.message };

  if (doc.target === "seller") {
    const { error: shopError } = await supabase.from("shops").insert({
      owner_id: doc.user_id,
      name: doc.shop_name ?? "Ma boutique",
      description: doc.shop_description ?? "",
      status: "pending",
    });
    if (shopError) return { success: false, error: shopError.message };
  }

  return { success: true };
}

/** Admin : refuse une demande KYC et repasse le profil en customer. */
export async function rejectKyc(
  doc: KycDocument,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  const { error: kycError } = await supabase
    .from("kyc_documents")
    .update({ status: "rejected", admin_comment: comment, reviewed_at: new Date().toISOString() })
    .eq("id", doc.id);
  if (kycError) return { success: false, error: kycError.message };

  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: "customer" })
    .eq("id", doc.user_id);
  if (roleError) return { success: false, error: roleError.message };

  return { success: true };
}
