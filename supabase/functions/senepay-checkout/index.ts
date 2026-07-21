// Supabase Edge Function : POST /functions/v1/senepay-checkout
//
// v1.0.1 : un paiement par LOT (order_batches), plus par commande individuelle.
// Reçoit un batchId appartenant à l'utilisateur authentifié, crée une session
// de paiement SenePay (Checkout hébergé) et renvoie l'URL de paiement.
//
// Sécurité : X-Api-Key / X-Api-Secret SenePay restent dans les secrets Supabase
// (jamais dans le bundle frontend). Voir supabase/functions/README.md.

import { serviceClient, corsHeaders } from "../_shared/supabaseAdmin.ts";

const SENEPAY_BASE_URL = "https://api.sene-pay.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Authentification requise." }, 401);
    }

    const admin = serviceClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData.user) {
      return json({ error: "Session invalide." }, 401);
    }
    const userId = userData.user.id;

    const { batchId, returnUrl, cancelUrl } = await req.json();
    if (!batchId) {
      return json({ error: "batchId requis." }, 400);
    }

    const { data: batch, error: batchError } = await admin
      .from("order_batches")
      .select("id, user_id, status, total_price, tracking_code")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return json({ error: "Commande introuvable." }, 404);
    }
    if (batch.user_id !== userId) {
      return json({ error: "Accès refusé à cette commande." }, 403);
    }
    if (batch.status !== "pending") {
      return json({ error: "Cette commande n'est plus en attente de paiement." }, 400);
    }

    const apiKey = Deno.env.get("SENEPAY_API_KEY");
    const apiSecret = Deno.env.get("SENEPAY_API_SECRET");
    if (!apiKey || !apiSecret) {
      return json({ error: "Clés SenePay non configurées côté serveur (secrets Supabase)." }, 500);
    }

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/senepay-webhook`;

    const senepayRes = await fetch(`${SENEPAY_BASE_URL}/api/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "X-Api-Secret": apiSecret,
      },
      body: JSON.stringify({
        amount: Math.round(Number(batch.total_price)),
        currency: "XOF",
        orderReference: batch.tracking_code,
        description: `Commande Alliance Colis ${batch.tracking_code}`,
        returnUrl,
        cancelUrl,
        webhookUrl,
        metadata: { batchId: batch.id },
        expiresInMinutes: 30,
      }),
    });

    const senepayData = await senepayRes.json();
    if (!senepayRes.ok || !senepayData.checkoutUrl) {
      return json(
        { error: senepayData.message ?? senepayData.error ?? "Erreur SenePay lors de la création de session." },
        senepayRes.status || 500
      );
    }

    await admin.from("order_batches").update({ payment_session_token: senepayData.sessionToken }).eq("id", batch.id);

    await admin.from("payments").insert({
      batch_id: batch.id,
      provider: "senepay",
      status: "pending",
      amount: batch.total_price,
      reference: senepayData.sessionToken,
      raw_response: senepayData,
    });

    return json({ checkoutUrl: senepayData.checkoutUrl, sessionToken: senepayData.sessionToken });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erreur inconnue." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
