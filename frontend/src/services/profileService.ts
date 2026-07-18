import { supabase } from "../lib/supabase";
import type { Profile, UserRole } from "../types";

/** Récupère le profil d'un utilisateur. Retourne null si absent (ex: juste après inscription). */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getProfile:", error.message);
    return null;
  }
  return data;
}

export async function createProfile(profile: {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("profiles").insert({
    ...profile,
    verified: false,
    role: "customer",
  });

  if (error) {
    console.error("createProfile:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Le client demande à devenir vendeur ou coursier (rôle passe en *_pending). */
export async function requestRoleUpgrade(
  userId: string,
  target: "seller" | "courier"
): Promise<{ success: boolean; error?: string }> {
  const role: UserRole = target === "seller" ? "seller_pending" : "courier_pending";
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Admin : liste tous les profils (avec filtre optionnel par rôle). */
export async function listProfiles(role?: UserRole): Promise<Profile[]> {
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (role) query = query.eq("role", role);
  const { data, error } = await query;
  if (error) {
    console.error("listProfiles:", error.message);
    return [];
  }
  return data ?? [];
}

/** Admin : modifie directement le rôle d'un utilisateur. */
export async function adminSetRole(userId: string, role: UserRole): Promise<boolean> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) {
    console.error("adminSetRole:", error.message);
    return false;
  }
  return true;
}

export async function updateAvatar(userId: string, avatarUrl: string): Promise<boolean> {
  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
  return !error;
}
