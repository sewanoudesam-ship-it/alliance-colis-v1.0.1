import { useEffect, useState } from "react";
import { getShopByOwner } from "../../services/shopService";
import { listShopProducts, toggleProductActive, deleteProduct } from "../../services/productService";
import { listShopOrders, updateOrderStatus } from "../../services/orderService";
import { getWallet, listWalletTransactions, currentSellerCommissionRate, listPendingPayouts } from "../../services/walletService";
import { formatFCFA, formatDateShort } from "../../utils/format";
import { ORDER_STATUS_LABELS } from "../../lib/constants";
import type { Shop, Product, Order, Wallet, ScheduledPayout } from "../../types";
import CreateShop from "./CreateShop";
import AddProduct from "./AddProduct";

type Props = { userId: string };
type Tab = "shop" | "products" | "orders" | "wallet";

export default function SellerDashboard({ userId }: Props) {
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof listWalletTransactions>>>([]);
  const [pendingPayouts, setPendingPayouts] = useState<ScheduledPayout[]>([]);
  const [addingProduct, setAddingProduct] = useState(false);

  async function loadShop() {
    setShop(await getShopByOwner(userId));
  }

  useEffect(() => {
    loadShop();
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

  if (shop === undefined) return <div className="ac-skeleton" style={{ height: 200 }} />;

  if (shop === null) {
    return <CreateShop ownerId={userId} onCreated={loadShop} />;
  }

  return (
    <div>
      <h1 className="ac-page-title">{shop.name}</h1>
      <p className="ac-page-subtitle">
        Statut boutique :{" "}
        <span className={`ac-badge ${shop.status === "approved" ? "ac-badge--success" : shop.status === "blocked" ? "ac-badge--danger" : "ac-badge--warning"}`}>
          {shop.status === "approved" ? "Validée" : shop.status === "blocked" ? "Bloquée" : "En attente de validation"}
        </span>
      </p>

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
              onCreated={() => { setAddingProduct(false); listShopProducts(shop.id).then(setProducts); }}
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
                      <button className="ac-btn ac-btn--outline ac-btn--sm" onClick={async () => { await toggleProductActive(p.id, !p.active); listShopProducts(shop.id).then(setProducts); }}>
                        {p.active ? "Désactiver" : "Activer"}
                      </button>
                      <button className="ac-btn ac-btn--ghost" onClick={async () => { await deleteProduct(p.id); listShopProducts(shop.id).then(setProducts); }}>🗑️</button>
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
                <span className="ac-row__title">{o.tracking_code}</span>
                <span className="ac-row__meta">{formatDateShort(o.created_at)} · {formatFCFA(o.items_total)}</span>
              </div>
              <select
                className="ac-select"
                value={o.status}
                onChange={async (e) => { await updateOrderStatus(o.id, e.target.value as Order["status"]); listShopOrders(shop.id).then(setOrders); }}
              >
                {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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
                      <span className="ac-row__title">{p.orders?.tracking_code}</span>
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
