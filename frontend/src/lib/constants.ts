import type { Country } from "../types";

/** Pays supportés CEDEAO/UEMOA — liste unique utilisée partout dans l'app. */
export const COUNTRIES: Country[] = [
  { code: "BJ", name: "Bénin", prefix: "+229" },
  { code: "BF", name: "Burkina Faso", prefix: "+226" },
  { code: "CV", name: "Cap-Vert", prefix: "+238" },
  { code: "CI", name: "Côte d'Ivoire", prefix: "+225" },
  { code: "GM", name: "Gambie", prefix: "+220" },
  { code: "GH", name: "Ghana", prefix: "+233" },
  { code: "GN", name: "Guinée", prefix: "+224" },
  { code: "GW", name: "Guinée-Bissau", prefix: "+245" },
  { code: "LR", name: "Liberia", prefix: "+231" },
  { code: "ML", name: "Mali", prefix: "+223" },
  { code: "MR", name: "Mauritanie", prefix: "+222" },
  { code: "NE", name: "Niger", prefix: "+227" },
  { code: "NG", name: "Nigeria", prefix: "+234" },
  { code: "SN", name: "Sénégal", prefix: "+221" },
  { code: "SL", name: "Sierra Leone", prefix: "+232" },
  { code: "TG", name: "Togo", prefix: "+228" },
];

/** Tarification livraison : 1000 FCFA jusqu'à 5km, puis +100 FCFA/km. */
export const DELIVERY_BASE_FEE = 1000;
export const DELIVERY_BASE_KM = 5;
export const DELIVERY_FEE_PER_EXTRA_KM = 100;

/** Paliers de commission plateforme sur les ventes vendeur (nombre de ventes cumulées). */
export const SELLER_COMMISSION_TIERS = [
  { minSales: 0, maxSales: 9, rate: 5 },
  { minSales: 10, maxSales: 24, rate: 8 },
  { minSales: 25, maxSales: Infinity, rate: 10 },
] as const;

/** Commission plateforme sur les livraisons coursier (25% Alliance Colis / 75% coursier). */
export const COURIER_COMMISSION_RATE = 25;
export const COURIER_PAYOUT_RATE = 75;

/** Opérateurs mobile money acceptés (choisis par le client sur la page SenePay). Purement informatif ici. */
export const MOBILE_MONEY_OPERATORS: { label: string; color: string; initials: string }[] = [
  { label: "Wave", color: "#1DC8E5", initials: "W" },
  { label: "Orange Money", color: "#FF6600", initials: "OM" },
  { label: "MTN MoMo", color: "#FFCC08", initials: "MTN" },
  { label: "Moov Money", color: "#0072BC", initials: "M" },
  { label: "Free Money", color: "#E4032E", initials: "F" },
];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Prête (confirmée)",
  processing: "En préparation",
  completed: "Livrée",
  cancelled: "Annulée",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  assigned: "Attribuée",
  picked_up: "Colis récupéré",
  out_for_delivery: "En cours de livraison",
  completed: "Livrée",
  cancelled: "Annulée",
};
