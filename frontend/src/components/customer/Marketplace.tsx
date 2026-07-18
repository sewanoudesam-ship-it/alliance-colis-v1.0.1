import { useEffect, useState } from "react";
import { listMarketplaceProducts } from "../../services/productService";
import { addToCart } from "../../services/cartService";
import { formatFCFA } from "../../utils/format";
import type { Product } from "../../types";

type Props = { userId: string; onAddedToCart?: () => void };

export default function Marketplace({ userId, onAddedToCart }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  async function load(query?: string) {
    setLoading(true);
    setProducts(await listMarketplaceProducts(query));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(search), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleAdd(productId: string) {
    setAddingId(productId);
    await addToCart(userId, productId);
    setAddingId(null);
    onAddedToCart?.();
  }

  return (
    <div>
      <h1 className="ac-page-title">Marketplace</h1>
      <p className="ac-page-subtitle">Trouvez vos produits près de chez vous.</p>

      <div className="ac-field">
        <input
          className="ac-input"
          placeholder="🔍 Rechercher un produit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="ac-product-grid">
          {[0, 1, 2, 3].map((i) => <div key={i} className="ac-skeleton" style={{ height: 190 }} />)}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="ac-empty">
          <div className="ac-empty__icon">🛍️</div>
          <div className="ac-empty__title">Aucun produit trouvé</div>
          <div className="ac-empty__text">Essayez une autre recherche.</div>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="ac-product-grid">
          {products.map((p) => (
            <div key={p.id} className="ac-product-card">
              <div className="ac-product-card__photo">
                {p.photo_url ? <img src={p.photo_url} alt={p.name} /> : "📦"}
              </div>
              <div className="ac-product-card__body">
                <span className="ac-product-card__shop">{p.shops?.name ?? "Boutique"}</span>
                <span className="ac-product-card__name">{p.name}</span>
                <span className="ac-product-card__price">{formatFCFA(p.price)}</span>
                <button
                  className="ac-btn ac-btn--dark ac-btn--sm ac-full-width ac-mt-8"
                  disabled={addingId === p.id}
                  onClick={() => handleAdd(p.id)}
                >
                  {addingId === p.id ? "Ajout…" : "Ajouter au panier"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
