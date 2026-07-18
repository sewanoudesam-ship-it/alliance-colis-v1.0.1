import { useState } from "react";
import { createShop } from "../../services/shopService";
import FileUploader from "../shared/FileUploader";

type Props = { ownerId: string; onCreated: () => void };

export default function CreateShop({ ownerId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Le nom de la boutique est requis.");
      return;
    }
    setSubmitting(true);
    const result = await createShop({
      owner_id: ownerId,
      name,
      description,
      logo_url: logoUrl || undefined,
      shop_lat: coords?.lat,
      shop_lng: coords?.lng,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Erreur lors de la création de la boutique.");
      return;
    }
    onCreated();
  }

  return (
    <div className="ac-card ac-card--pad">
      <h3 className="ac-mb-8">Créer ma boutique</h3>
      {error && <div className="ac-alert ac-alert--danger">{error}</div>}
      <div className="ac-field">
        <label className="ac-label">Nom de la boutique</label>
        <input className="ac-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="ac-field">
        <label className="ac-label">Description</label>
        <textarea className="ac-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <FileUploader
        bucket="shops"
        userId={ownerId}
        label="Logo de la boutique"
        currentUrl={logoUrl || undefined}
        onUploaded={setLogoUrl}
      />
      <button className="ac-btn ac-btn--outline ac-mb-8" onClick={locate} disabled={locating}>
        {locating ? "Localisation…" : coords ? "📍 Position enregistrée" : "📍 Localiser ma boutique"}
      </button>
      <p className="ac-text-sm ac-mb-8">Cette position sert à calculer les frais de livraison de vos clients.</p>
      <button className="ac-btn ac-btn--primary" disabled={submitting} onClick={handleSubmit}>
        {submitting ? "Création…" : "Créer la boutique"}
      </button>
    </div>
  );
}
