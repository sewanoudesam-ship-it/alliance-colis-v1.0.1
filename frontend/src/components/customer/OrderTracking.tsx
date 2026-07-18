import { useEffect, useState } from "react";
import { listCustomerOrders, getOrderByTrackingCode } from "../../services/orderService";
import { getDeliveryByOrder } from "../../services/deliveryService";
import { formatFCFA, formatDateShort } from "../../utils/format";
import { ORDER_STATUS_LABELS, DELIVERY_STATUS_LABELS } from "../../lib/constants";
import type { Order, Delivery } from "../../types";
import LiveTracking from "../tracking/LiveTracking";

type Props = { userId: string };

export default function OrderTracking({ userId }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    listCustomerOrders(userId).then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }, [userId]);

  async function openOrder(order: Order) {
    setSelected(order);
    setDelivery(undefined);
    setDelivery(await getDeliveryByOrder(order.id));
  }

  async function handleSearchCode() {
    setSearchError(null);
    if (!code.trim()) return;
    const order = await getOrderByTrackingCode(code.trim().toUpperCase());
    if (!order) {
      setSearchError("Aucune commande trouvée pour ce code.");
      return;
    }
    openOrder(order);
  }

  if (selected) {
    return (
      <div>
        <button className="ac-btn ac-btn--ghost ac-mb-8" style={{ width: "auto" }} onClick={() => setSelected(null)}>← Retour</button>
        <h1 className="ac-page-title">Commande {selected.tracking_code}</h1>
        <div className="ac-card ac-card--pad ac-mb-8">
          <div className="ac-flex ac-justify-between ac-mb-8">
            <span className="ac-text-sm">Statut</span>
            <span className="ac-badge ac-badge--brand">{ORDER_STATUS_LABELS[selected.status]}</span>
          </div>
          <div className="ac-flex ac-justify-between ac-mb-8">
            <span className="ac-text-sm">Adresse</span>
            <span>{selected.delivery_address}</span>
          </div>
          <div className="ac-flex ac-justify-between ac-mb-8">
            <span className="ac-text-sm">Total</span>
            <strong>{formatFCFA(selected.total_price)}</strong>
          </div>
          <div className="ac-flex ac-justify-between">
            <span className="ac-text-sm">Passée le</span>
            <span>{formatDateShort(selected.created_at)}</span>
          </div>
        </div>

        {delivery === undefined && <div className="ac-skeleton" style={{ height: 100 }} />}

        {delivery === null && (
          <div className="ac-card ac-card--pad ac-text-center">
            <p className="ac-text-sm">Aucun coursier n'est encore assigné à cette commande.</p>
          </div>
        )}

        {delivery && (
          <>
            <p className="ac-section-title">Livraison — {DELIVERY_STATUS_LABELS[delivery.status]}</p>
            <LiveTracking delivery={delivery} />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="ac-page-title">Suivi commande</h1>
      <p className="ac-page-subtitle">Retrouvez vos commandes ou saisissez un code de suivi.</p>

      <div className="ac-card ac-card--pad ac-mb-8">
        <div className="ac-input-group">
          <input className="ac-input" placeholder="Ex : AC-7K3F9Q" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="ac-btn ac-btn--dark" style={{ width: "auto" }} onClick={handleSearchCode}>Suivre</button>
        </div>
        {searchError && <p className="ac-text-sm" style={{ color: "var(--danger)" }}>{searchError}</p>}
      </div>

      {loading && <div className="ac-skeleton" style={{ height: 120 }} />}

      {!loading && orders.length === 0 && (
        <div className="ac-empty">
          <div className="ac-empty__icon">📦</div>
          <div className="ac-empty__title">Aucune commande pour le moment</div>
        </div>
      )}

      <div className="ac-list">
        {orders.map((o) => (
          <button key={o.id} className="ac-row" style={{ width: "100%", border: "1px solid var(--line)" }} onClick={() => openOrder(o)}>
            <div className="ac-row__main">
              <span className="ac-row__title">{o.tracking_code}</span>
              <span className="ac-row__meta">{formatDateShort(o.created_at)} · {formatFCFA(o.total_price)}</span>
            </div>
            <span className="ac-badge ac-badge--neutral">{ORDER_STATUS_LABELS[o.status]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
