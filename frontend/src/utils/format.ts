/** Formatte un montant en Francs CFA, ex : formatFCFA(1200) -> "1 200 FCFA". */
export function formatFCFA(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
}

/** Formatte une date courte en français, ex : "17 juil. 2026". */
export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
