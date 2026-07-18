// Supabase Edge Function : POST /functions/v1/senepay-webhook
//
// Reçoit les notifications SenePay (checkout.session.completed / .failed),
// vérifie la signature HMAC-SHA256 (header X-SenePay-Signature) avec le
// webhookSigningSecret, puis met à jour `payments` et `orders`.
//
// Le passage d'une commande à "confirmed" déclenche automatiquement (trigger SQL
// trg_create_delivery) la création d'une livraison assignable aux coursiers.

import { serviceClient, corsHeaders } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();
  const signature = req.headers.get("x-senepay-signature") ?? "";
  const webhookSecret = Deno.env.get("SENEPAY_WEBHOOK_SECRET");

  if (!webhookSecret) {
    console.error("SENEPAY_WEBHOOK_SECRET non configuré côté serveur.");
    return new Response("Server misconfigured", { status: 500 });
  }

  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  if (expected !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const admin = serviceClient();

  const { data: orders } = await admin
    .from("orders")
    .select("id, status, total_price")
    .eq("payment_session_token", payload.sessionToken);
  if (!orders || orders.length === 0) {
    // Toujours répondre 200 : on ne veut pas que SenePay ré-essaie indéfiniment
    // pour une session qu'on ne retrouve pas (ex: test manuel).
    return new Response(JSON.stringify({ received: true, note: "no matching order" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (payload.event === "checkout.session.completed") {
    for (const order of orders) {
      await admin
        .from("payments")
        .update({ status: "success", raw_response: payload })
        .eq("order_id", order.id)
        .eq("reference", payload.sessionToken);

      if (order.status === "pending") {
        // Le prix total (produits + livraison) est crédité au compte central
        // Alliance Colis. Les parts vendeur/coursier en seront débitées plus
        // tard, de façon différée (10min coursier / 24h vendeur), une fois la
        // livraison terminée — voir process_scheduled_payouts() en base.
        await admin.rpc("credit_platform_account", { p_amount: order.total_price });

        // Passage à "confirmed" -> déclenche le trigger de création de livraison.
        await admin.from("orders").update({ status: "confirmed" }).eq("id", order.id);
      }
    }
  }

  if (payload.event === "checkout.session.failed") {
    for (const order of orders) {
      await admin
        .from("payments")
        .update({ status: "failed", raw_response: payload })
        .eq("order_id", order.id)
        .eq("reference", payload.sessionToken);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
