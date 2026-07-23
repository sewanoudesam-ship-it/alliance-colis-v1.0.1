import { useEffect, useState } from "react";
import { listKyc, approveKyc, rejectKyc } from "../../services/kycService";
import { listShops, setShopStatus } from "../../services/shopService";
import { listPendingProducts, approveProduct } from "../../services/productService";
import { listProfiles, adminSetRole } from "../../services/profileService";
import { listAllBatches, confirmBatchDistance, listBatchesReadyForDispatch, dispatchBatch } from "../../services/orderService";
import { listAllActiveDeliveries } from "../../services/deliveryService";
import { getPlatformAccount } from "../../services/walletService";
import { listWarehouses, updateWarehouse, getActiveWarehouse } from "../../services/warehouseService";
import { formatFCFA, formatDateShort } from "../../utils/format";
import { ORDER_STATUS_LABELS, DELIVERY_STATUS_LABELS } from "../../lib/constants";
import Toast from "../shared/Toast";
import type { KycDocument, Shop, Product, Profile, OrderBatch, Delivery, PlatformAccount, Warehouse } from "../../types";

type Tab = "overview" | "kyc" | "shops" | "products" | "users" | "dispatch" | "deliveries" | "orders" | "warehouse";
type ToastState = { type: "success" | "danger"; text: string } | null;

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [kyc, setKyc] = useState<KycDocument[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [batches, setBatches] = useState<OrderBatch[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [readyBatches, setReadyBatches] = useState<OrderBatch[]>([]);
  const [couriers, setCouriers] = useState<Profile[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState<Warehouse | null>(null);
  const [courierDrafts, setCourierDrafts] = useState<Record<string, string>>({});
  const [platformAccount, setPlatformAccount] = useState<PlatformAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [distanceDrafts, setDistanceDrafts] = useState<Record<string, string>>({});

  function flashSuccess(text: string) {
    setToast({ type: "success", text });
    setTimeout(() => setToast(null), 4000);
  }
  function flashError(text: string) {
    setToast({ type: "danger", text });
  }

  async function refresh() {
    setLoading(true);
    if (tab === "overview") {
      const [b, s, p, pa] = await Promise.all([listAllBatches(), listShops(), listProfiles(), getPlatformAccount()]);
      setBatches(b); setShops(s); setProfiles(p); setPlatformAccount(pa);
    }
    if (tab === "kyc") setKyc(await listKyc("pending"));
    if (tab === "shops") setShops(await listShops());
    if (tab === "products") setProducts(await listPendingProducts());
    if (tab === "users") setProfiles(await listProfiles());
    if (tab === "deliveries") setDeliveries(await listAllActiveDeliveries());
    if (tab === "orders") setBatches(await listAllBatches());
    if (tab === "warehouse") setWarehouses(await listWarehouses());
    if (tab === "dispatch") {
      const [rb, c, w] = await Promise.all([
        listBatchesReadyForDispatch(),
        listProfiles("courier"),
        getActiveWarehouse(),
      ]);
      setReadyBatches(rb);
      setCouriers(c);
      setActiveWarehouse(w);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleApproveKyc(doc: KycDocument) {
    setBusyId(doc.id);
    const result = await approveKyc(doc);
    setBusyId(null);
    if (!result.success) { flashError(result.error ?? "Échec de la validation KYC."); return; }
    flashSuccess(`${doc.full_name} validé(e) avec succès.`);
    refresh();
  }

  async function handleRejectKyc(doc: KycDocument) {
    setBusyId(doc.id);
    const result = await rejectKyc(doc, rejectComment);
    setBusyId(null);
    setRejectingId(null);
    setRejectComment("");
    if (!result.success) { flashError(result.error ?? "Échec du refus."); return; }
    flashSuccess(`Demande de ${doc.full_name} refusée.`);
    refresh();
  }

  async function handleShopStatus(shop: Shop, status: Shop["status"]) {
    setBusyId(shop.id);
    const ok = await setShopStatus(shop.id, status);
    setBusyId(null);
    if (!ok) { flashError(`Échec de la mise à jour du statut de "${shop.name}". Réessayez.`); return; }
    flashSuccess(`Statut de "${shop.name}" mis à jour.`);
    refresh();
  }

  async function handleApproveProduct(product: Product) {
    setBusyId(product.id);
    const ok = await approveProduct(product.id);
    setBusyId(null);
    if (!ok) { flashError(`Échec de la validation de "${product.name}". Réessayez.`); return; }
    flashSuccess(`"${product.name}" validé et visible sur la marketplace.`);
    refresh();
  }

  async function handleSetRole(profile: Profile, role: Profile["role"]) {
    setBusyId(profile.id);
    const ok = await adminSetRole(profile.id, role);
    setBusyId(null);
    if (!ok) { flashError(`Échec de la mise à jour du rôle de "${profile.full_name}".`); return; }
    flashSuccess(`Rôle de "${profile.full_name}" mis à jour.`);
    refresh();
  }

  async function handleConfirmDistance(batch: OrderBatch) {
    const raw = distanceDrafts[batch.id];
    const km = Number(raw);
    if (!raw || isNaN(km) || km < 0) { flashError("Distance invalide."); return; }
    setBusyId(batch.id);
    const ok = await confirmBatchDistance(batch.id, km);
    setBusyId(null);
    if (!ok) { flashError(`Échec de la mise à jour de ${batch.tracking_code}.`); return; }
    flashSuccess(`Distance confirmée pour ${batch.tracking_code} : ${km} km.`);
    refresh();
  }

  async function handleUpdateWarehouse(w: Warehouse, patch: Partial<Warehouse>) {
    setBusyId(w.id);
    const ok = await updateWarehouse(w.id, patch);
    setBusyId(null);
    if (!ok) { flashError("Échec de la mise à jour de l'entrepôt."); return; }
    flashSuccess("Entrepôt mis à jour.");
    refresh();
  }

  async function handleDispatch(batch: OrderBatch) {
    const courierId = courierDrafts[batch.id];
    if (!courierId) { flashError("Choisissez un coursier avant de valider."); return; }
    if (!activeWarehouse) { flashError("Aucun entrepôt actif configuré."); return; }

    setBusyId(batch.id);
    const result = await dispatchBatch(batch.id, courierId, activeWarehouse.warehouse_lat, activeWarehouse.warehouse_lng);
    setBusyId(null);
    if (!result.success) { flashError(result.error ?? `Échec de l'assignation pour ${batch.tracking_code}.`); return; }
    flashSuccess(`${batch.tracking_code} assignée au coursier — position de départ : entrepôt.`);
    refresh();
  }

  const batchesNeedingConfirmation = batches.filter((b) => b.location_source === "address");

  return (
    <div>
      <h1 className="ac-page-title">Administration</h1>
      <p className="ac-page-subtitle">Gestion globale de la plateforme Alliance Colis.</p>

      <Toast toast={toast} />

      <div className="ac-tabs">
        <button className={`ac-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Vue d'ensemble</button>
        <button className={`ac-tab ${tab === "kyc" ? "active" : ""}`} onClick={() => setTab("kyc")}>KYC</button>
        <button className={`ac-tab ${tab === "shops" ? "active" : ""}`} onClick={() => setTab("shops")}>Boutiques</button>
        <button className={`ac-tab ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>Produits</button>
        <button className={`ac-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Utilisateurs</button>
        <button className={`ac-tab ${tab === "dispatch" ? "active" : ""}`} onClick={() => setTab("dispatch")}>Dispatch</button>
        <button className={`ac-tab ${tab === "deliveries" ? "active" : ""}`} onClick={() => setTab("deliveries")}>Livraisons</button>
        <button className={`ac-tab ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>Commandes</button>
        <button className={`ac-tab ${tab === "warehouse" ? "active" : ""}`} onClick={() => setTab("warehouse")}>Entrepôt</button>
      </div>

      {loading && <div className="ac-skeleton" style={{ height: 160 }} />}

      {!loading && tab === "overview" && (
        <>
          <div className="ac-stat-grid ac-mb-8">
            <div className="ac-stat-card"><div className="ac-stat-card__value">{profiles.length}</div><div className="ac-stat-card__label">Utilisateurs</div></div>
            <div className="ac-stat-card"><div className="ac-stat-card__value">{shops.filter(s => s.status === "approved").length}</div><div className="ac-stat-card__label">Boutiques actives</div></div>
            <div className="ac-stat-card"><div className="ac-stat-card__value">{batches.length}</div><div className="ac-stat-card__label">Commandes totales</div></div>
            <div className="ac-stat-card"><div className="ac-stat-card__value">{formatFCFA(batches.reduce((s, b) => s + b.total_price, 0))}</div><div className="ac-stat-card__label">Volume total</div></div>
          </div>

          {batchesNeedingConfirmation.length > 0 && (
            <div className="ac-alert ac-alert--warning ac-mb-8">
              {batchesNeedingConfirmation.length} commande(s) sans GPS attendent une confirmation de
              distance — voir l'onglet <strong>Commandes</strong>.
            </div>
          )}

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
                    <button className="ac-btn ac-btn--danger" disabled={busyId === doc.id} onClick={() => handleRejectKyc(doc)}>
                      {busyId === doc.id ? "Envoi…" : "Confirmer le refus"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ac-flex ac-gap-8 ac-mt-16">
                  <button className="ac-btn ac-btn--outline" disabled={busyId === doc.id} onClick={() => setRejectingId(doc.id)}>Refuser</button>
                  <button className="ac-btn ac-btn--primary" disabled={busyId === doc.id} onClick={() => handleApproveKyc(doc)}>
                    {busyId === doc.id ? "Validation…" : "Valider"}
                  </button>
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
              <select className="ac-select" value={s.status} disabled={busyId === s.id} onChange={(e) => handleShopStatus(s, e.target.value as Shop["status"])}>
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
              <button className="ac-btn ac-btn--primary ac-btn--sm" disabled={busyId === p.id} onClick={() => handleApproveProduct(p)}>
                {busyId === p.id ? "Validation…" : "Valider"}
              </button>
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
              <select className="ac-select" value={p.role} disabled={busyId === p.id} onChange={(e) => handleSetRole(p, e.target.value as Profile["role"])}>
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

      {!loading && tab === "dispatch" && (
        <>
          <p className="ac-text-sm ac-mb-8">
            Lots payés dont toutes les boutiques ont confirmé leur part — prêts à être assignés à un coursier.
            La position de départ du coursier sera automatiquement celle de l'entrepôt actif
            ({activeWarehouse?.name ?? "aucun entrepôt actif"}).
          </p>
          <div className="ac-list">
            {readyBatches.length === 0 && (
              <div className="ac-empty">
                <div className="ac-empty__icon">📦</div>
                <div className="ac-empty__title">Aucun lot prêt pour le moment</div>
                <div className="ac-empty__text">Les lots apparaissent ici une fois toutes leurs boutiques confirmées.</div>
              </div>
            )}
            {readyBatches.map((b) => (
              <div key={b.id} className="ac-card ac-card--pad">
                <div className="ac-flex ac-justify-between ac-mb-8">
                  <span className="ac-row__title">{b.tracking_code}</span>
                  <span className="ac-badge ac-badge--success">Prêt à expédier</span>
                </div>
                <p className="ac-text-sm ac-mb-8">{b.delivery_address} · {formatFCFA(b.total_price)}</p>
                <div className="ac-flex ac-gap-8">
                  <select
                    className="ac-select ac-full-width"
                    value={courierDrafts[b.id] ?? ""}
                    onChange={(e) => setCourierDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                  >
                    <option value="">Choisir un coursier…</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                  <button className="ac-btn ac-btn--primary ac-btn--sm" disabled={busyId === b.id} onClick={() => handleDispatch(b)}>
                    {busyId === b.id ? "…" : "Valider"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && tab === "deliveries" && (
        <div className="ac-list">
          {deliveries.length === 0 && <div className="ac-empty"><div className="ac-empty__icon">🚚</div><div className="ac-empty__title">Aucune livraison active</div></div>}
          {deliveries.map((d) => (
            <div key={d.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">{d.order_batches?.tracking_code}</span>
                <span className="ac-row__meta">{d.order_batches?.delivery_address}</span>
              </div>
              <span className="ac-badge ac-badge--brand">{DELIVERY_STATUS_LABELS[d.status]}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "orders" && (
        <div className="ac-list">
          {batches.map((b) => (
            <div key={b.id} className="ac-card ac-card--pad">
              <div className="ac-flex ac-justify-between ac-mb-8">
                <span className="ac-row__title">{b.tracking_code}</span>
                <span className="ac-badge ac-badge--neutral">{ORDER_STATUS_LABELS[b.status]}</span>
              </div>
              <p className="ac-text-sm ac-mb-8">{formatDateShort(b.created_at)} · {formatFCFA(b.total_price)} · {b.delivery_address}</p>
              {b.location_source === "address" ? (
                <div className="ac-flex ac-gap-8">
                  <input
                    className="ac-input"
                    type="number"
                    placeholder="Distance réelle (km)"
                    value={distanceDrafts[b.id] ?? ""}
                    onChange={(e) => setDistanceDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                  />
                  <button className="ac-btn ac-btn--dark ac-btn--sm" disabled={busyId === b.id} onClick={() => handleConfirmDistance(b)}>
                    Confirmer
                  </button>
                </div>
              ) : (
                <span className="ac-text-sm">Distance : {b.distance_km ?? "?"} km ({b.location_source === "gps" ? "GPS" : "confirmée manuellement"})</span>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "warehouse" && (
        <div className="ac-list">
          {warehouses.map((w) => (
            <WarehouseEditor key={w.id} warehouse={w} busy={busyId === w.id} onSave={(patch) => handleUpdateWarehouse(w, patch)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WarehouseEditor({ warehouse, busy, onSave }: { warehouse: Warehouse; busy: boolean; onSave: (patch: Partial<Warehouse>) => void }) {
  const [name, setName] = useState(warehouse.name);
  const [address, setAddress] = useState(warehouse.address);
  const [lat, setLat] = useState(String(warehouse.warehouse_lat));
  const [lng, setLng] = useState(String(warehouse.warehouse_lng));

  return (
    <div className="ac-card ac-card--pad">
      <div className="ac-field">
        <label className="ac-label">Nom</label>
        <input className="ac-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="ac-field">
        <label className="ac-label">Adresse</label>
        <input className="ac-input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="ac-input-group ac-field">
        <div style={{ flex: 1 }}>
          <label className="ac-label">Latitude</label>
          <input className="ac-input" value={lat} onChange={(e) => setLat(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="ac-label">Longitude</label>
          <input className="ac-input" value={lng} onChange={(e) => setLng(e.target.value)} />
        </div>
      </div>
      <button
        className="ac-btn ac-btn--primary"
        disabled={busy}
        onClick={() => onSave({ name, address, warehouse_lat: Number(lat), warehouse_lng: Number(lng) })}
      >
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
