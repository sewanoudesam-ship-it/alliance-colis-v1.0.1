import { useEffect, useState } from "react";
import {
  listAvailableMissions,
  listCourierMissions,
  listCourierHistory,
  acceptMission,
  updateDeliveryStatus,
  updateCourierPosition,
} from "../../services/deliveryService";
import { getWallet, listPendingPayouts } from "../../services/walletService";
import { formatFCFA, formatDateShort } from "../../utils/format";
import { DELIVERY_STATUS_LABELS } from "../../lib/constants";
import type { Delivery, DeliveryStatus, Wallet, ScheduledPayout } from "../../types";

type Props = { userId: string };
type Tab = "available" | "active" | "history" | "wallet";

const NEXT_STATUS: Record<string, DeliveryStatus | null> = {
  assigned: "picked_up",
  picked_up: "out_for_delivery",
  out_for_delivery: "completed",
  completed: null,
};

const NEXT_LABEL: Record<string, string> = {
  assigned: "Marquer colis récupéré",
  picked_up: "Marquer en cours de livraison",
  out_for_delivery: "Marquer livré",
};

export default function CourierDashboard({ userId }: Props) {
  const [tab, setTab] = useState<Tab>("available");
  const [available, setAvailable] = useState<Delivery[]>([]);
  const [active, setActive] = useState<Delivery[]>([]);
  const [history, setHistory] = useState<Delivery[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState<ScheduledPayout[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    if (tab === "available") setAvailable(await listAvailableMissions());
    if (tab === "active") setActive(await listCourierMissions(userId));
    if (tab === "history") setHistory(await listCourierHistory(userId));
    if (tab === "wallet") {
      setWallet(await getWallet(userId));
      setPendingPayouts(await listPendingPayouts("courier"));
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleAccept(deliveryId: string) {
    await acceptMission(deliveryId, userId);
    refresh();
  }

  async function handleAdvance(delivery: Delivery) {
    const next = NEXT_STATUS[delivery.status];
    if (!next) return;

    if (next === "picked_up" || next === "out_for_delivery") {
      navigator.geolocation?.getCurrentPosition((pos) => {
        updateCourierPosition(delivery.id, pos.coords.latitude, pos.coords.longitude);
      });
    }

    await updateDeliveryStatus(delivery.id, next);
    refresh();
  }

  return (
    <div>
      <h1 className="ac-page-title">Espace coursier</h1>
      <p className="ac-page-subtitle">Vos missions de livraison.</p>

      <div className="ac-tabs">
        <button className={`ac-tab ${tab === "available" ? "active" : ""}`} onClick={() => setTab("available")}>Disponibles</button>
        <button className={`ac-tab ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>En cours</button>
        <button className={`ac-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Historique</button>
        <button className={`ac-tab ${tab === "wallet" ? "active" : ""}`} onClick={() => setTab("wallet")}>Portefeuille</button>
      </div>

      {loading && <div className="ac-skeleton" style={{ height: 160 }} />}

      {!loading && tab === "available" && (
        <div className="ac-list">
          {available.length === 0 && <div className="ac-empty"><div className="ac-empty__icon">🛵</div><div className="ac-empty__title">Aucune mission disponible</div></div>}
          {available.map((d) => (
            <div key={d.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">{d.order_batches?.tracking_code}</span>
                <span className="ac-row__meta">{d.order_batches?.delivery_address} · {formatFCFA(d.order_batches?.delivery_fee ?? 0)}</span>
              </div>
              <button className="ac-btn ac-btn--primary ac-btn--sm" onClick={() => handleAccept(d.id)}>Accepter</button>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "active" && (
        <div className="ac-list">
          {active.length === 0 && <div className="ac-empty"><div className="ac-empty__icon">🚚</div><div className="ac-empty__title">Aucune mission en cours</div></div>}
          {active.map((d) => (
            <div key={d.id} className="ac-card ac-card--pad">
              <div className="ac-flex ac-justify-between ac-mb-8">
                <span className="ac-row__title">{d.order_batches?.tracking_code}</span>
                <span className="ac-badge ac-badge--brand">{DELIVERY_STATUS_LABELS[d.status]}</span>
              </div>
              <p className="ac-text-sm ac-mb-8">{d.order_batches?.delivery_address}</p>
              {NEXT_STATUS[d.status] && (
                <button className="ac-btn ac-btn--dark" onClick={() => handleAdvance(d)}>{NEXT_LABEL[d.status]}</button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "history" && (
        <div className="ac-list">
          {history.length === 0 && <div className="ac-empty"><div className="ac-empty__icon">📜</div><div className="ac-empty__title">Aucun historique</div></div>}
          {history.map((d) => (
            <div key={d.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">{d.order_batches?.tracking_code}</span>
                <span className="ac-row__meta">{d.completed_at ? formatDateShort(d.completed_at) : ""}</span>
              </div>
              <span className="ac-badge ac-badge--neutral">{DELIVERY_STATUS_LABELS[d.status]}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "wallet" && wallet && (
        <>
          <div className="ac-stat-grid ac-mb-8">
            <div className="ac-stat-card">
              <div className="ac-stat-card__value">{formatFCFA(wallet.balance)}</div>
              <div className="ac-stat-card__label">Solde disponible</div>
            </div>
            <div className="ac-stat-card">
              <div className="ac-stat-card__value">75%</div>
              <div className="ac-stat-card__label">Votre part sur chaque livraison</div>
            </div>
          </div>

          {pendingPayouts.length > 0 && (
            <>
              <p className="ac-section-title">En attente de versement (10 min après livraison)</p>
              <div className="ac-list">
                {pendingPayouts.map((p) => (
                  <div key={p.id} className="ac-row">
                    <div className="ac-row__main">
                      <span className="ac-row__title">{p.order_batches?.tracking_code}</span>
                      <span className="ac-row__meta">Versement prévu le {new Date(p.run_at).toLocaleString("fr-FR")}</span>
                    </div>
                    <span className="ac-badge ac-badge--warning">{formatFCFA(p.order_batches?.delivery_fee ?? 0)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
