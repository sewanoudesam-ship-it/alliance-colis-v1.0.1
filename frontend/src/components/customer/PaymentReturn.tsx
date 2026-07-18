import { useEffect, useState } from "react";
import { listCustomerOrders } from "../../services/orderService";
import { formatFCFA } from "../../utils/format";
import { ORDER_STATUS_LABELS } from "../../lib/constants";
import type { Order } from "../../types";

type Props = { userId: string; cancelled: boolean; onDone: () => void };

/**
 * N'affirme jamais elle-même qu'un paiement a réussi : elle relit simplement
 * l'état de la commande en base (mis à jour par le webhook SenePay, seule
 * source de vérité — voir supabase/functions/senepay-webhook).
 */
export default function PaymentReturn({ userId, cancelled, onDone }: Props) {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    let attempts = 0;
    const poll = async () => {
      const orders = await listCustomerOrders(userId);
      const latest = orders[0] ?? null;
      setOrder(latest);
      attempts += 1;
      // Le webhook peut arriver quelques secondes après la redirection : on
      // ré-interroge brièvement si la commande est encore "pending".
      if (latest?.status === "pending" && attempts < 6) {
        setTimeout(poll, 2000);
      }
    };
    poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (cancelled) {
    return (
      <div className="ac-card ac-card--pad ac-text-center">
        <div style={{ fontSize: 40, marginBottom: 10 }}>↩️</div>
        <h3 className="ac-mb-8">Paiement annulé</h3>
        <p className="ac-text-sm ac-mb-8">Vous avez annulé le paiement. Votre commande reste en attente, vous pouvez réessayer depuis le panier.</p>
        <button className="ac-btn ac-btn--primary" onClick={onDone}>Retour à l'accueil</button>
      </div>
    );
  }

  if (order === undefined) {
    return <div className="ac-skeleton" style={{ height: 200 }} />;
  }

  const isPaid = order && order.status !== "pending";

  return (
    <div className="ac-card ac-card--pad ac-text-center">
      <div style={{ fontSize: 40, marginBottom: 10 }}>{isPaid ? "✅" : "⏳"}</div>
      <h3 className="ac-mb-8">{isPaid ? "Paiement confirmé" : "Paiement en cours de vérification…"}</h3>
      {order && (
        <>
          <p className="ac-text-sm ac-mb-8">
            Commande {order.tracking_code} · {formatFCFA(order.total_price)} ·{" "}
            <span className="ac-badge ac-badge--brand">{ORDER_STATUS_LABELS[order.status]}</span>
          </p>
        </>
      )}
      <p className="ac-text-sm ac-mb-8">
        {isPaid
          ? "Suivez votre commande dans l'onglet Suivi commande."
          : "La confirmation peut prendre quelques secondes. Vous pouvez aussi vérifier plus tard dans Suivi commande."}
      </p>
      <button className="ac-btn ac-btn--primary" onClick={onDone}>Continuer</button>
    </div>
  );
}
