import { supabase } from "../lib/supabase";

/**
 * Passerelle de paiement — intégration réelle SenePay (Checkout hébergé).
 *
 * SenePay agrège Wave, Orange Money, MTN, Moov et Free Money derrière une seule
 * page de paiement sécurisée (choix de l'opérateur fait par le client sur cette
 * page). La clé secrète et le secret de webhook ne sont JAMAIS présents dans ce
 * fichier ni dans le bundle frontend : ils vivent uniquement dans les secrets de
 * l'Edge Function Supabase `senepay-checkout` / `senepay-webhook`
 * (voir supabase/functions/README.md).
 *
 * Flux (v1.0.1 — un paiement par LOT, plus par commande individuelle) :
 *  1. initiateSenepayCheckout() appelle l'Edge Function avec l'ID du lot.
 *  2. L'Edge Function crée la session SenePay et renvoie `checkoutUrl`.
 *  3. Le client est redirigé vers `checkoutUrl` (page SenePay).
 *  4. Après paiement, SenePay redirige vers `returnUrl` ET envoie un webhook
 *     signé à l'Edge Function `senepay-webhook`, qui est la source de vérité :
 *     elle marque le lot "confirmed" (ce qui déclenche automatiquement la
 *     création d'une livraison unique via le trigger SQL).
 *  5. L'écran de retour (PaymentReturn.tsx) réaffiche simplement l'état courant
 *     du lot — il ne décide jamais lui-même du succès du paiement.
 */

export type CheckoutSessionResult = {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
};

export async function initiateSenepayCheckout(batchId: string): Promise<CheckoutSessionResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { success: false, error: "Vous devez être connecté pour payer." };
  }

  const origin = window.location.origin;

  const { data, error } = await supabase.functions.invoke("senepay-checkout", {
    body: {
      batchId,
      returnUrl: `${origin}/?payment_return=1`,
      cancelUrl: `${origin}/?payment_cancelled=1`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data?.checkoutUrl) {
    return { success: false, error: data?.error ?? "Impossible de créer la session de paiement." };
  }

  return { success: true, checkoutUrl: data.checkoutUrl };
}
