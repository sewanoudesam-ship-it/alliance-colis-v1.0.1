import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * true si les variables d'environnement essentielles sont présentes.
 * Utilisé par main.tsx pour afficher un écran d'explication au lieu d'une
 * page blanche silencieuse quand `frontend/.env` est absent (ex: juste après
 * un `git clone`, puisque .env est volontairement exclu du dépôt).
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Valeurs de secours uniquement pour éviter que createClient() ne lève une
// exception au chargement du module (qui provoquerait, elle, une vraie page
// blanche non récupérable). L'écran d'avertissement dans main.tsx empêche de
// toute façon d'utiliser l'app tant que .env n'est pas correctement rempli.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
