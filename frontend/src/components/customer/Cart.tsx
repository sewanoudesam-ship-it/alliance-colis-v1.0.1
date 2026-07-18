import { useEffect, useState } from "react";
import { getCart, updateCartQuantity, removeFromCart } from "../../services/cartService";
import { formatFCFA } from "../../utils/format";
import type { CartItem } from "../../types";
import Checkout from "./Checkout";

type Props = { userId: string; onOrderPlaced?: () => void };

export default function Cart({ userId, onOrderPlaced }: Props) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  async function load() {
    setLoading(true);
    setItems(await getCart(userId));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [userId]);

  async function handleQuantity(itemId: string, quantity: number) {
    await updateCartQuantity(itemId, quantity);
    load();
  }

  async function handleRemove(itemId: string) {
    await removeFromCart(itemId);
    load();
  }

  const itemsTotal = items.reduce((sum, i) => sum + (i.products?.price ?? 0) * i.quantity, 0);

  if (checkingOut) {
    return (
      <Checkout
        userId={userId}
        cartItems={items}
        onBack={() => setCheckingOut(false)}
        onSuccess={() => {
          setCheckingOut(false);
          load();
          onOrderPlaced?.();
        }}
      />
    );
  }

  return (
    <div>
      <h1 className="ac-page-title">Panier</h1>
      <p className="ac-page-subtitle">Vérifiez votre commande avant de passer au paiement.</p>

      {loading && <div className="ac-skeleton" style={{ height: 140 }} />}

      {!loading && items.length === 0 && (
        <div className="ac-empty">
          <div className="ac-empty__icon">🛒</div>
          <div className="ac-empty__title">Votre panier est vide</div>
          <div className="ac-empty__text">Ajoutez des produits depuis la marketplace.</div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="ac-list ac-mb-8">
            {items.map((item) => (
              <div key={item.id} className="ac-row">
                <div className="ac-row__main">
                  <span className="ac-row__title">{item.products?.name}</span>
                  <span className="ac-row__meta">
                    {formatFCFA(item.products?.price ?? 0)} · {item.products?.shops?.name}
                  </span>
                </div>
                <div className="ac-flex ac-items-center ac-gap-8">
                  <button className="ac-btn ac-btn--outline ac-btn--sm" onClick={() => handleQuantity(item.id, item.quantity - 1)}>−</button>
                  <span>{item.quantity}</span>
                  <button className="ac-btn ac-btn--outline ac-btn--sm" onClick={() => handleQuantity(item.id, item.quantity + 1)}>+</button>
                  <button className="ac-btn ac-btn--ghost" onClick={() => handleRemove(item.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>

          <div className="ac-card ac-card--pad">
            <div className="ac-flex ac-justify-between ac-mb-8">
              <span className="ac-text-sm">Sous-total produits</span>
              <strong>{formatFCFA(itemsTotal)}</strong>
            </div>
            <p className="ac-text-sm ac-mb-8">Les frais de livraison seront calculés à l'étape suivante selon votre adresse.</p>
            <button className="ac-btn ac-btn--primary" onClick={() => setCheckingOut(true)}>
              Passer la commande
            </button>
          </div>
        </>
      )}
    </div>
  );
}
