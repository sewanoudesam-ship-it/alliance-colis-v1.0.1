// Supabase Edge Function : POST /functions/v1/senepay-checkout
//
// Reçoit une liste d'orderIds appartenant à l'utilisateur authentifié, calcule le
// montant total, crée une session de paiement SenePay (Checkout hébergé) et
// renvoie l'URL de paiement vers laquelle rediriger le client.
//
// Sécurité : X-Api-Key / X-Api-Secret SenePay restent dans les secrets Supabase
// (jamais dans le bundle frontend). Voir supabase/functions/README.md pour le
// déploiement et la configuration des secrets.

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

    const { orderIds, returnUrl, cancelUrl } = await req.json();
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return json({ error: "orderIds requis." }, 400);
    }

    const { data: orders, error: ordersError } = await admin
      .from("orders")
      .select("id, user_id, status, total_price, tracking_code")
      .in("id", orderIds);

    if (ordersError || !orders || orders.length !== orderIds.length) {
      return json({ error: "Commande(s) introuvable(s)." }, 404);
    }
    if (orders.some((o) => o.user_id !== userId)) {
      return json({ error: "Accès refusé à une des commandes." }, 403);
    }
    if (orders.some((o) => o.status !== "pending")) {
      return json({ error: "Une des commandes n'est plus en attente de paiement." }, 400);
    }

    const totalAmount = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
    const orderReference = `AC-${orders.map((o) => o.tracking_code).join("+")}`.slice(0, 60);

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
        amount: Math.round(totalAmount),
        currency: "XOF",
        orderReference,
        description: `Commande Alliance Colis ${orderReference}`,
        returnUrl,
        cancelUrl,
        webhookUrl,
        metadata: { orderIds: orderIds.join(",") },
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

    await admin
      .from("orders")
      .update({ payment_session_token: senepayData.sessionToken })
      .in("id", orderIds);

    for (const order of orders) {
      await admin.from("payments").insert({
        order_id: order.id,
        provider: "senepay",
        status: "pending",
        amount: order.total_price,
        reference: senepayData.sessionToken,
        raw_response: senepayData,
      });
    }

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
