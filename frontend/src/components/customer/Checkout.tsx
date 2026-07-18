import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { createOrdersFromCart } from "../../services/orderService";
import { initiateSenepayCheckout } from "../../services/paymentService";
import { haversineDistanceKm, calculateDeliveryFee } from "../../utils/pricing";
import { formatFCFA } from "../../utils/format";
import { MOBILE_MONEY_OPERATORS } from "../../lib/constants";
import type { CartItem } from "../../types";

type Props = {
  userId: string;
  cartItems: CartItem[];
  onBack: () => void;
  onSuccess: () => void;
};

type Step = "address" | "payment";

export default function Checkout({ userId, cartItems, onBack, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsTotal = useMemo(
    () => cartItems.reduce((sum, i) => sum + (i.products?.price ?? 0) * i.quantity, 0),
    [cartItems]
  );

  function locateMe() {
    setLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setLocating(false);
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("Impossible de récupérer votre position. Autorisez la géolocalisation ou réessayez.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function continueToPayment() {
    setError(null);
    if (!address.trim()) {
      setError("Veuillez saisir votre adresse de livraison.");
      return;
    }
    if (!coords) {
      setError("Merci de partager votre position pour estimer les frais de livraison.");
      return;
    }
    setStep("payment");
  }

  async function distanceByShopMap(): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const shopIds = Array.from(new Set(cartItems.map((i) => i.products?.shop_id).filter(Boolean))) as string[];
    const { data: shops } = await supabase.from("shops").select("id, shop_lat, shop_lng").in("id", shopIds);
    for (const shop of shops ?? []) {
      if (shop.shop_lat != null && shop.shop_lng != null && coords) {
        map.set(shop.id, haversineDistanceKm(coords.lat, coords.lng, shop.shop_lat, shop.shop_lng));
      } else {
        map.set(shop.id, 0);
      }
    }
    return map;
  }

  const estimatedFee = useMemo(() => calculateDeliveryFee(5), []);

  async function handlePay() {
    if (!coords) return;
    setProcessing(true);
    setError(null);

    const distances = await distanceByShopMap();
    const checkout = await createOrdersFromCart(userId, cartItems, address, coords.lat, coords.lng, distances);

    if (!checkout.success || checkout.orders.length === 0) {
      setProcessing(false);
      setError(checkout.error ?? "Impossible de créer la commande.");
      return;
    }

    const orderIds = checkout.orders.map((o) => o.id);
    const session = await initiateSenepayCheckout(orderIds);

    if (!session.success || !session.checkoutUrl) {
      setProcessing(false);
      setError(session.error ?? "Impossible d'initier le paiement. Réessayez.");
      return;
    }

    // Redirection vers la page de paiement hébergée SenePay (Wave / Orange / MTN / Moov / Free).
    window.location.href = session.checkoutUrl;
  }

  return (
    <div>
      <button className="ac-btn ac-btn--ghost ac-mb-8" style={{ width: "auto" }} onClick={onBack}>← Retour au panier</button>
      <h1 className="ac-page-title">{step === "address" ? "Adresse de livraison" : "Paiement"}</h1>

      {error && <div className="ac-alert ac-alert--danger">{error}</div>}

      {step === "address" && (
        <div className="ac-card ac-card--pad">
          <div className="ac-field">
            <label className="ac-label">Adresse / point de repère</label>
            <input className="ac-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ex : Cocody Angré, Abidjan" />
          </div>
          <button className="ac-btn ac-btn--outline ac-mb-8" onClick={locateMe} disabled={locating}>
            {locating ? "Localisation…" : coords ? "📍 Position enregistrée" : "📍 Partager ma position"}
          </button>
          <div className="ac-flex ac-justify-between ac-mt-8">
            <span className="ac-text-sm">Frais de livraison estimés</span>
            <strong>{formatFCFA(estimatedFee)}+</strong>
          </div>
          <p className="ac-text-sm ac-mb-8">Le montant exact est calculé selon la distance réelle jusqu'à la boutique (1000 FCFA jusqu'à 5km, puis +100 FCFA/km).</p>
          <button className="ac-btn ac-btn--primary" onClick={continueToPayment}>Continuer</button>
        </div>
      )}

      {step === "payment" && (
        <div className="ac-card ac-card--pad">
          <div className="ac-flex ac-justify-between ac-mb-8">
            <span className="ac-text-sm">Total produits</span>
            <strong>{formatFCFA(itemsTotal)}</strong>
          </div>

          <p className="ac-section-title ac-mt-16">Payer avec Mobile Money</p>
          <div className="ac-flex ac-gap-8 ac-mb-8" style={{ flexWrap: "wrap" }}>
            {MOBILE_MONEY_OPERATORS.map((op) => (
              <span key={op.label} className="ac-badge" style={{ background: `${op.color}18`, color: op.color }}>
                {op.label}
              </span>
            ))}
          </div>
          <p className="ac-text-sm ac-mb-8">
            Vous choisirez votre opérateur sur la page de paiement sécurisée SenePay.
          </p>

          <div className="ac-alert ac-alert--info">
            Paiement sécurisé via SenePay (environnement sandbox — aucune vraie transaction n'est débitée en test).
          </div>

          <button className="ac-btn ac-btn--primary" disabled={processing} onClick={handlePay}>
            {processing ? "Redirection…" : `Payer ${formatFCFA(itemsTotal + estimatedFee)}`}
          </button>
        </div>
      )}
    </div>
  );
}
