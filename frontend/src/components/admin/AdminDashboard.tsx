import { useEffect, useState } from "react";
import { listKyc, approveKyc, rejectKyc } from "../../services/kycService";
import { listShops, setShopStatus } from "../../services/shopService";
import { listPendingProducts, approveProduct } from "../../services/productService";
import { listProfiles, adminSetRole } from "../../services/profileService";
import { listAllOrders } from "../../services/orderService";
import { listAllActiveDeliveries } from "../../services/deliveryService";
import { getPlatformAccount } from "../../services/walletService";
import { formatFCFA, formatDateShort } from "../../utils/format";
import { ORDER_STATUS_LABELS, DELIVERY_STATUS_LABELS } from "../../lib/constants";
import type { KycDocument, Shop, Product, Profile, Order, Delivery, PlatformAccount } from "../../types";

type Tab = "overview" | "kyc" | "shops" | "products" | "users" | "deliveries" | "orders";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [kyc, setKyc] = useState<KycDocument[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [platformAccount, setPlatformAccount] = useState<PlatformAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  async function refresh() {
    setLoading(true);
    if (tab === "overview") {
      const [o, s, p, pa] = await Promise.all([listAllOrders(), listShops(), listProfiles(), getPlatformAccount()]);
      setOrders(o); setShops(s); setProfiles(p); setPlatformAccount(pa);
    }
    if (tab === "kyc") setKyc(await listKyc("pending"));
    if (tab === "shops") setShops(await listShops());
    if (tab === "products") setProducts(await listPendingProducts());
    if (tab === "users") setProfiles(await listProfiles());
    if (tab === "deliveries") setDeliveries(await listAllActiveDeliveries());
    if (tab === "orders") setOrders(await listAllOrders());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      <h1 className="ac-page-title">Administration</h1>
      <p className="ac-page-subtitle">Gestion globale de la plateforme Alliance Colis.</p>

      <div className="ac-tabs">
        <button className={`ac-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Vue d'ensemble</button>
        <button className={`ac-tab ${tab === "kyc" ? "active" : ""}`} onClick={() => setTab("kyc")}>KYC</button>
        <button className={`ac-tab ${tab === "shops" ? "active" : ""}`} onClick={() => setTab("shops")}>Boutiques</button>
        <button className={`ac-tab ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>Produits</button>
        <button className={`ac-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Utilisateurs</button>
        <button className={`ac-tab ${tab === "deliveries" ? "active" : ""}`} onClick={() => setTab("deliveries")}>Livraisons</button>
        <button className={`ac-tab ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>Commandes</button>
      </div>

      {loading && <div className="ac-skeleton" style={{ height: 160 }} />}

      {!loading && tab === "overview" && (
        <>
          <div className="ac-stat-grid ac-mb-8">
            <div className="ac-stat-card"><div className="ac-stat-card__value">{profiles.length}</div><div className="ac-stat-card__label">Utilisateurs</div></div>
            <div className="ac-stat-card"><div className="ac-stat-card__value">{shops.filter(s => s.status === "approved").length}</div><div className="ac-stat-card__label">Boutiques actives</div></div>
            <div className="ac-stat-card"><div className="ac-stat-card__value">{orders.length}</div><div className="ac-stat-card__label">Commandes totales</div></div>
            <div className="ac-stat-card"><div className="ac-stat-card__value">{formatFCFA(orders.reduce((s, o) => s + o.total_price, 0))}</div><div className="ac-stat-card__label">Volume total</div></div>
          </div>

          <p className="ac-section-title">Compte central Alliance Colis</p>
          <div className="ac-stat-grid">
            <div className="ac-stat-card">
              <div className="ac-stat-card__value">{formatFCFA(platformAccount?.balance ?? 0)}</div>
              <div className="ac-stat-card__label">Trésorerie (paiements reçus, avant versements)</div>
            </div>
            <div className="ac-stat-card">
              <div className="ac-stat-card__value">{formatFCFA(platformAccount?.total_commission_earned ?? 0)}</div>
              <div className="ac-stat-card__label">Revenu net cumulé (commissions retenues)</div>
            </div>
          </div>
          <p className="ac-text-sm ac-mt-8">
            Les versements boutiques (5/8/10% de commission) partent 24h après chaque livraison
            terminée ; les versements coursiers (25% de commission) partent 10 minutes après.
          </p>
        </>
      )}

      {!loading && tab === "kyc" && (
        <div className="ac-list">
          {kyc.length === 0 && <div className="ac-empty"><div className="ac-empty__icon">🪪</div><div className="ac-empty__title">Aucune demande en attente</div></div>}
          {kyc.map((doc) => (
            <div key={doc.id} className="ac-card ac-card--pad">
              <div className="ac-flex ac-justify-between ac-mb-8">
                <span className="ac-row__title">{doc.full_name}</span>
                <span className="ac-badge ac-badge--brand">{doc.target === "seller" ? "Vendeur" : "Coursier"}</span>
              </div>
              <p className="ac-text-sm ac-mb-8">Tél : {doc.phone}{doc.shop_name ? ` · Boutique : ${doc.shop_name}` : ""}</p>
              <a className="ac-text-sm" href={doc.id_document_url} target="_blank" rel="noreferrer">Voir le justificatif ↗</a>

              {rejectingId === doc.id ? (
                <div className="ac-mt-16">
                  <textarea className="ac-input ac-mb-8" rows={2} placeholder="Motif du refus" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
                  <div className="ac-flex ac-gap-8">
                    <button className="ac-btn ac-btn--outline" onClick={() => setRejectingId(null)}>Annuler</button>
                    <button className="ac-btn ac-btn--danger" onClick={async () => { await rejectKyc(doc, rejectComment); setRejectingId(null); setRejectComment(""); refresh(); }}>Confirmer le refus</button>
                  </div>
                </div>
              ) : (
                <div className="ac-flex ac-gap-8 ac-mt-16">
                  <button className="ac-btn ac-btn--outline" onClick={() => setRejectingId(doc.id)}>Refuser</button>
                  <button className="ac-btn ac-btn--primary" onClick={async () => { await approveKyc(doc); refresh(); }}>Valider</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "shops" && (
        <div className="ac-list">
          {shops.map((s) => (
            <div key={s.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">{s.name}</span>
                <span className="ac-row__meta">{formatDateShort(s.created_at)}</span>
              </div>
              <select className="ac-select" value={s.status} onChange={async (e) => { await setShopStatus(s.id, e.target.value as Shop["status"]); refresh(); }}>
                <option value="pending">En attente</option>
                <option value="approved">Validée</option>
                <option value="blocked">Bloquée</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "products" && (
        <div className="ac-list">
          {products.length === 0 && <div className="ac-empty"><div className="ac-empty__icon">📦</div><div className="ac-empty__title">Aucun produit en attente</div></div>}
          {products.map((p) => (
            <div key={p.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">{p.name}</span>
                <span className="ac-row__meta">{formatFCFA(p.price)} · {p.shops?.name}</span>
              </div>
              <button className="ac-btn ac-btn--primary ac-btn--sm" onClick={async () => { await approveProduct(p.id); refresh(); }}>Valider</button>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "users" && (
        <div className="ac-list">
          {profiles.map((p) => (
            <div key={p.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">{p.full_name}</span>
                <span className="ac-row__meta">{p.email} · {p.country}</span>
              </div>
              <select className="ac-select" value={p.role} onChange={async (e) => { await adminSetRole(p.id, e.target.value as Profile["role"]); refresh(); }}>
                <option value="customer">Client</option>
                <option value="seller_pending">Vendeur (en attente)</option>
                <option value="seller">Vendeur</option>
                <option value="courier_pending">Coursier (en attente)</option>
                <option value="courier">Coursier</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "deliveries" && (
        <div className="ac-list">
          {deliveries.length === 0 && <div className="ac-empty"><div className="ac-empty__icon">🚚</div><div className="ac-empty__title">Aucune livraison active</div></div>}
          {deliveries.map((d) => (
            <div key={d.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">{d.orders?.tracking_code}</span>
                <span className="ac-row__meta">{d.orders?.delivery_address}</span>
              </div>
              <span className="ac-badge ac-badge--brand">{DELIVERY_STATUS_LABELS[d.status]}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "orders" && (
        <div className="ac-list">
          {orders.map((o) => (
            <div key={o.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">{o.tracking_code}</span>
                <span className="ac-row__meta">{formatDateShort(o.created_at)} · {formatFCFA(o.total_price)}</span>
              </div>
              <span className="ac-badge ac-badge--neutral">{ORDER_STATUS_LABELS[o.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
