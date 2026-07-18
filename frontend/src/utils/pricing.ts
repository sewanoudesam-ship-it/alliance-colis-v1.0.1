import {
  DELIVERY_BASE_FEE,
  DELIVERY_BASE_KM,
  DELIVERY_FEE_PER_EXTRA_KM,
  SELLER_COMMISSION_TIERS,
  COURIER_COMMISSION_RATE,
} from "../lib/constants";

/**
 * Calcule le tarif de livraison.
 * Règle : 1000 FCFA jusqu'à 5km, puis +100 FCFA par km supplémentaire.
 * Exemple : 7km -> 1000 + (7-5)*100 = 1200 FCFA.
 */
export function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= DELIVERY_BASE_KM) return DELIVERY_BASE_FEE;
  const extraKm = Math.ceil(distanceKm - DELIVERY_BASE_KM);
  return DELIVERY_BASE_FEE + extraKm * DELIVERY_FEE_PER_EXTRA_KM;
}

/** Distance à vol d'oiseau (km) entre deux points GPS — formule de Haversine. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Taux de commission plateforme applicable au vendeur selon son nombre de ventes cumulées. */
export function getSellerCommissionRate(totalSalesCount: number): number {
  const tier = SELLER_COMMISSION_TIERS.find(
    (t) => totalSalesCount >= t.minSales && totalSalesCount <= t.maxSales
  );
  return tier ? tier.rate : SELLER_COMMISSION_TIERS[SELLER_COMMISSION_TIERS.length - 1].rate;
}

/** Montant net crédité au vendeur après commission plateforme. */
export function getSellerNetAmount(grossAmount: number, totalSalesCount: number): number {
  const rate = getSellerCommissionRate(totalSalesCount);
  return Math.round(grossAmount * (1 - rate / 100));
}

/** Montant net crédité au coursier après commission plateforme (25% Alliance Colis / 75% coursier). */
export function getCourierNetAmount(deliveryFee: number): number {
  return Math.round(deliveryFee * (1 - COURIER_COMMISSION_RATE / 100));
}
