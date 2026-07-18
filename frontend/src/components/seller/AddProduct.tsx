import { useState } from "react";
import { createProduct } from "../../services/productService";
import FileUploader from "../shared/FileUploader";

type Props = { shopId: string; userId: string; onCreated: () => void; onCancel: () => void };

export default function AddProduct({ shopId, userId, onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (!name.trim() || !priceNum || priceNum <= 0) {
      setError("Nom et prix valides requis.");
      return;
    }
    setSubmitting(true);
    const result = await createProduct({
      shop_id: shopId,
      name,
      description,
      price: priceNum,
      stock: stockNum || 0,
      photo_url: photoUrl || undefined,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Erreur lors de l'ajout du produit.");
      return;
    }
    onCreated();
  }

  return (
    <div className="ac-card ac-card--pad">
      <h3 className="ac-mb-8">Ajouter un produit</h3>
      {error && <div className="ac-alert ac-alert--danger">{error}</div>}
      <div className="ac-field">
        <label className="ac-label">Nom du produit</label>
        <input className="ac-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="ac-field">
        <label className="ac-label">Description</label>
        <textarea className="ac-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="ac-input-group ac-field">
        <div style={{ flex: 1 }}>
          <label className="ac-label">Prix (FCFA)</label>
          <input className="ac-input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="ac-label">Stock</label>
          <input className="ac-input" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
      </div>
      <FileUploader
        bucket="products"
        userId={userId}
        label="Photo du produit"
        currentUrl={photoUrl || undefined}
        onUploaded={setPhotoUrl}
      />
      <p className="ac-text-sm ac-mb-8">Votre produit sera visible sur la marketplace après validation par un administrateur.</p>
      <div className="ac-flex ac-gap-8">
        <button className="ac-btn ac-btn--outline" onClick={onCancel}>Annuler</button>
        <button className="ac-btn ac-btn--primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Ajout…" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}
