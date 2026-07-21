import { useEffect, useMemo, useState } from "react";
import { getActiveWarehouse } from "../../services/warehouseService";
import { createBatchFromCart } from "../../services/orderService";
import { initiateSenepayCheckout } from "../../services/paymentService";
import { haversineDistanceKm, calculateDeliveryFee } from "../../utils/pricing";
import { formatFCFA } from "../../utils/format";
import { MOBILE_MONEY_OPERATORS } from "../../lib/constants";
import type { CartItem, LocationSource, Warehouse } from "../../types";

type Props = {
  userId: string;
  cartItems: CartItem[];
  onBack: () => void;
  onSuccess: () => void;
};

type Step = "address" | "payment";

/**
 * Le GPS n'est plus un blocage : si le client ne le partage pas (ou que son
 * téléphone ne le permet pas), la commande part quand même avec l'adresse
 * saisie à la main (location_source = "address"). Un administrateur confirme
 * ensuite la distance réelle pour ajuster le tarif si besoin
 * (location_source passe alors à "manual_confirmation").
 */
export default function Checkout({ userId, cartItems, onBack, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("address");
  const [warehouse, setWarehouse] = useState<Warehouse | null | undefined>(undefined);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAttempted, setGpsAttempted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActiveWarehouse().then(setWarehouse);
  }, []);

  const itemsTotal = useMemo(
    () => cartItems.reduce((sum, i) => sum + (i.products?.price ?? 0) * i.quantity, 0),
    [cartItems]
  );

  const distanceKm = useMemo(() => {
    if (!coords || !warehouse) return null;
    return haversineDistanceKm(coords.lat, coords.lng, warehouse.warehouse_lat, warehouse.warehouse_lng);
  }, [coords, warehouse]);

  const locationSource: LocationSource = coords ? "gps" : "address";
  const estimatedFee = distanceKm != null ? calculateDeliveryFee(distanceKm) : calculateDeliveryFee(0);

  function locateMe() {
    setLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setLocating(false);
      setGpsAttempted(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        setGpsAttempted(true);
      },
      () => {
        // Échec/refus GPS : ce n'est plus bloquant, la commande continuera
        // avec l'adresse saisie manuellement.
        setLocating(false);
        setGpsAttempted(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function continueToPayment() {
    setError(null);
    if (!address.trim()) {
      setError("Veuillez saisir votre adresse, quartier ou point de repère.");
      return;
    }
    setStep("payment");
  }

  async function handlePay() {
    if (!warehouse) return;
    setProcessing(true);
    setError(null);

    const checkout = await createBatchFromCart(
      userId,
      cartItems,
      warehouse.id,
      address,
      locationSource,
      coords?.lat ?? null,
      coords?.lng ?? null,
      distanceKm
    );

    if (!checkout.success || !checkout.batch) {
      setProcessing(false);
      setError(checkout.error ?? "Impossible de créer la commande.");
      return;
    }

    const session = await initiateSenepayCheckout(checkout.batch.id);

    if (!session.success || !session.checkoutUrl) {
      setProcessing(false);
      setError(session.error ?? "Impossible d'initier le paiement. Réessayez.");
      return;
    }

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
            <label className="ac-label">Adresse / quartier / point de repère</label>
            <input className="ac-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ex : Cocody Angré, non loin de la pharmacie" />
          </div>

          <button className="ac-btn ac-btn--outline ac-mb-8" onClick={locateMe} disabled={locating}>
            {locating ? "Localisation…" : coords ? "📍 Position précise enregistrée" : "📍 Partager ma position (optionnel)"}
          </button>

          {gpsAttempted && !coords && (
            <div className="ac-alert ac-alert--info">
              Pas de souci : votre commande sera traitée avec l'adresse saisie ci-dessus. Un tarif
              de livraison précis sera confirmé rapidement par notre équipe.
            </div>
          )}

          <div className="ac-flex ac-justify-between ac-mt-8">
            <span className="ac-text-sm">Frais de livraison {coords ? "" : "(estimation)"}</span>
            <strong>{formatFCFA(estimatedFee)}{coords ? "" : "+"}</strong>
          </div>
          <p className="ac-text-sm ac-mb-8">
            Calculé depuis notre entrepôt jusqu'à votre adresse : 1000 FCFA jusqu'à 5km, puis +100 FCFA/km.
            {distanceKm != null && ` Distance estimée : ${distanceKm.toFixed(1)} km.`}
          </p>

          <button className="ac-btn ac-btn--primary" onClick={continueToPayment} disabled={warehouse === undefined}>
            {warehouse === undefined ? "Chargement…" : "Continuer"}
          </button>
        </div>
      )}

      {step === "payment" && (
        <div className="ac-card ac-card--pad">
          <div className="ac-flex ac-justify-between ac-mb-8">
            <span className="ac-text-sm">Total produits</span>
            <strong>{formatFCFA(itemsTotal)}</strong>
          </div>
          <div className="ac-flex ac-justify-between ac-mb-8">
            <span className="ac-text-sm">Livraison{coords ? "" : " (provisoire)"}</span>
            <strong>{formatFCFA(estimatedFee)}</strong>
          </div>

          <p className="ac-section-title ac-mt-16">Payer avec Mobile Money</p>
          <div className="ac-flex ac-gap-8 ac-mb-8" style={{ flexWrap: "wrap" }}>
            {MOBILE_MONEY_OPERATORS.map((op) => (
              <span key={op.label} className="ac-badge" style={{ background: `${op.color}18`, color: op.color }}>
                {op.label}
              </span>
            ))}
          </div>
          <p className="ac-text-sm ac-mb-8">Vous choisirez votre opérateur sur la page de paiement sécurisée SenePay.</p>

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
