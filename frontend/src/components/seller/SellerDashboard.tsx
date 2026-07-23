import { useEffect, useState } from "react";
import { getShopByOwner } from "../../services/shopService";
import { listShopProducts, toggleProductActive, deleteProduct } from "../../services/productService";
import { listShopOrders, updateOrderStatus } from "../../services/orderService";
import { getWallet, listWalletTransactions, currentSellerCommissionRate, listPendingPayouts } from "../../services/walletService";
import { formatFCFA, formatDateShort } from "../../utils/format";
import { ORDER_STATUS_LABELS } from "../../lib/constants";
import Toast from "../shared/Toast";
import type { Shop, Product, Order, Wallet, ScheduledPayout } from "../../types";
import CreateShop from "./CreateShop";
import AddProduct from "./AddProduct";

type Props = { userId: string };
type Tab = "shop" | "products" | "orders" | "wallet";

/**
 * Le vendeur ne contrôle que la préparation de sa part : "confirmé" signale
 * à l'entrepôt que sa part est prête. "Livré" est désormais déclenché
 * automatiquement par la livraison (coursier), pas choisi manuellement ici.
 */
const SELLER_EDITABLE_STATUSES: Order["status"][] = ["pending", "processing", "confirmed", "cancelled"];
type ToastState = { type: "success" | "danger"; text: string } | null;

export default function SellerDashboard({ userId }: Props) {
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof listWalletTransactions>>>([]);
  const [pendingPayouts, setPendingPayouts] = useState<ScheduledPayout[]>([]);
  const [addingProduct, setAddingProduct] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function flashSuccess(text: string) {
    setToast({ type: "success", text });
    setTimeout(() => setToast(null), 4000);
  }
  function flashError(text: string) {
    setToast({ type: "danger", text });
  }

  async function loadShop() {
    setShop(await getShopByOwner(userId));
  }

  useEffect(() => {
    loadShop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Si un administrateur valide la boutique pendant que ce tableau de bord est
  // déjà ouvert, on rafraîchit automatiquement dès que l'onglet redevient actif
  // (au lieu d'afficher un statut périmé jusqu'au prochain rechargement manuel).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") loadShop();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!shop) return;
    if (tab === "products") listShopProducts(shop.id).then(setProducts);
    if (tab === "orders") listShopOrders(shop.id).then(setOrders);
    if (tab === "wallet") {
      getWallet(userId).then((w) => {
        setWallet(w);
        if (w?.id) listWalletTransactions(w.id).then(setTransactions);
      });
      listPendingPayouts("seller").then(setPendingPayouts);
    }
  }, [tab, shop, userId]);

  async function handleToggleProduct(product: Product) {
    if (!shop) return;
    setBusyId(product.id);
    const ok = await toggleProductActive(product.id, !product.active);
    setBusyId(null);
    if (!ok) {
      flashError(`Échec de la mise à jour de "${product.name}". Réessayez.`);
      return;
    }
    flashSuccess(`"${product.name}" ${!product.active ? "activé" : "désactivé"}.`);
    listShopProducts(shop.id).then(setProducts);
  }

  async function handleDeleteProduct(product: Product) {
    if (!shop) return;
    setBusyId(product.id);
    const ok = await deleteProduct(product.id);
    setBusyId(null);
    if (!ok) {
      flashError(`Échec de la suppression de "${product.name}". Réessayez.`);
      return;
    }
    flashSuccess(`"${product.name}" supprimé.`);
    listShopProducts(shop.id).then(setProducts);
  }

  async function handleOrderStatus(order: Order, status: Order["status"]) {
    if (!shop) return;
    setBusyId(order.id);
    const ok = await updateOrderStatus(order.id, status);
    setBusyId(null);
    if (!ok) {
      flashError(`Échec de la mise à jour de la commande #${order.id.slice(0, 8).toUpperCase()}.`);
      return;
    }
    flashSuccess(`Commande #${order.id.slice(0, 8).toUpperCase()} mise à jour.`);
    listShopOrders(shop.id).then(setOrders);
  }

  if (shop === undefined) return <div className="ac-skeleton" style={{ height: 200 }} />;

  if (shop === null) {
    return <CreateShop ownerId={userId} onCreated={loadShop} />;
  }

  return (
    <div>
      <h1 className="ac-page-title">{shop.name}</h1>
      <p className="ac-page-subtitle ac-flex ac-items-center ac-gap-8">
        Statut boutique :{" "}
        <span className={`ac-badge ${shop.status === "approved" ? "ac-badge--success" : shop.status === "blocked" ? "ac-badge--danger" : "ac-badge--warning"}`}>
          {shop.status === "approved" ? "Validée" : shop.status === "blocked" ? "Bloquée" : "En attente de validation"}
        </span>
        <button className="ac-btn ac-btn--ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={loadShop} title="Actualiser le statut">
          ↻ Actualiser
        </button>
      </p>

      <Toast toast={toast} />

      <div className="ac-tabs">
        <button className={`ac-tab ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>Produits</button>
        <button className={`ac-tab ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>Commandes</button>
        <button className={`ac-tab ${tab === "wallet" ? "active" : ""}`} onClick={() => setTab("wallet")}>Portefeuille</button>
      </div>

      {tab === "products" && (
        <>
          {addingProduct ? (
            <AddProduct
              shopId={shop.id}
              userId={userId}
              onCancel={() => setAddingProduct(false)}
              onCreated={() => { setAddingProduct(false); flashSuccess("Produit ajouté avec succès."); listShopProducts(shop.id).then(setProducts); }}
            />
          ) : (
            <>
              <button className="ac-btn ac-btn--primary ac-mb-8" onClick={() => setAddingProduct(true)}>+ Ajouter un produit</button>
              {shop.status !== "approved" && (
                <div className="ac-alert ac-alert--info">
                  Vos produits ne seront visibles sur la marketplace qu'une fois votre boutique validée par l'administrateur.
                </div>
              )}
              <div className="ac-list">
                {products.length === 0 && (
                  <div className="ac-empty"><div className="ac-empty__icon">📦</div><div className="ac-empty__title">Aucun produit</div></div>
                )}
                {products.map((p) => (
                  <div key={p.id} className="ac-row">
                    <div className="ac-row__main">
                      <span className="ac-row__title">{p.name}</span>
                      <span className="ac-row__meta">
                        {formatFCFA(p.price)} · stock {p.stock}
                        {" · "}
                        {p.approved ? <span className="ac-badge ac-badge--success">Validé</span> : <span className="ac-badge ac-badge--warning">En attente</span>}
                      </span>
                    </div>
                    <div className="ac-flex ac-gap-8">
                      <button className="ac-btn ac-btn--outline ac-btn--sm" disabled={busyId === p.id} onClick={() => handleToggleProduct(p)}>
                        {p.active ? "Désactiver" : "Activer"}
                      </button>
                      <button className="ac-btn ac-btn--ghost" disabled={busyId === p.id} onClick={() => handleDeleteProduct(p)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "orders" && (
        <div className="ac-list">
          {orders.length === 0 && (
            <div className="ac-empty"><div className="ac-empty__icon">🧾</div><div className="ac-empty__title">Aucune commande reçue</div></div>
          )}
          {orders.map((o) => (
            <div key={o.id} className="ac-row">
              <div className="ac-row__main">
                <span className="ac-row__title">Commande #{o.id.slice(0, 8).toUpperCase()}</span>
                <span className="ac-row__meta">{formatDateShort(o.created_at)} · {formatFCFA(o.items_total)}</span>
              </div>
              {o.status === "completed" || o.status === "cancelled" ? (
                <span className={`ac-badge ${o.status === "completed" ? "ac-badge--success" : "ac-badge--danger"}`}>
                  {ORDER_STATUS_LABELS[o.status]}
                </span>
              ) : (
                <select
                  className="ac-select"
                  value={o.status}
                  disabled={busyId === o.id}
                  onChange={(e) => handleOrderStatus(o, e.target.value as Order["status"])}
                >
                  {SELLER_EDITABLE_STATUSES.map((value) => (
                    <option key={value} value={value}>{ORDER_STATUS_LABELS[value]}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "wallet" && wallet && (
        <>
          <div className="ac-stat-grid ac-mb-8">
            <div className="ac-stat-card">
              <div className="ac-stat-card__value">{formatFCFA(wallet.balance)}</div>
              <div className="ac-stat-card__label">Solde disponible</div>
            </div>
            <div className="ac-stat-card">
              <div className="ac-stat-card__value">{currentSellerCommissionRate(wallet)}%</div>
              <div className="ac-stat-card__label">Commission actuelle ({wallet.total_sales_count} ventes)</div>
            </div>
          </div>

          {pendingPayouts.length > 0 && (
            <>
              <p className="ac-section-title">En attente de versement (24h après livraison)</p>
              <div className="ac-list ac-mb-8">
                {pendingPayouts.map((p) => (
                  <div key={p.id} className="ac-row">
                    <div className="ac-row__main">
                      <span className="ac-row__title">Vente boutique</span>
                      <span className="ac-row__meta">Versement prévu le {new Date(p.run_at).toLocaleString("fr-FR")}</span>
                    </div>
                    <span className="ac-badge ac-badge--warning">{formatFCFA(p.orders?.items_total ?? 0)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="ac-section-title">Historique</p>
          <div className="ac-list">
            {transactions.length === 0 && <p className="ac-text-sm">Aucune transaction pour le moment.</p>}
            {transactions.map((t) => (
              <div key={t.id} className="ac-row">
                <div className="ac-row__main">
                  <span className="ac-row__title">Vente ({t.commission_rate}% commission)</span>
                  <span className="ac-row__meta">{formatDateShort(t.created_at)}</span>
                </div>
                <strong style={{ color: "var(--success)" }}>+{formatFCFA(t.amount)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
