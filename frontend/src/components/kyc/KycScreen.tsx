import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { submitKyc } from "../../services/kycService";
import type { KycDocument, KycTarget } from "../../types";
import FileUploader from "../shared/FileUploader";

type Props = {
  userId: string;
  target: KycTarget; // "seller" | "courier"
  onSubmitted?: () => void;
};

export default function KycScreen({ userId, target, onSubmitted }: Props) {
  const [existing, setExisting] = useState<KycDocument | null | undefined>(undefined);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [idDocumentUrl, setIdDocumentUrl] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [vehicleType, setVehicleType] = useState("moto");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("kyc_documents")
        .select("*")
        .eq("user_id", userId)
        .eq("target", target)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setExisting(data ?? null);
    }
    load();
  }, [userId, target]);

  async function handleSubmit() {
    setError(null);
    if (!fullName || !phone || !idDocumentUrl) {
      setError("Veuillez renseigner votre identité, votre téléphone et un justificatif.");
      return;
    }
    if (target === "seller" && !shopName) {
      setError("Le nom de votre boutique est requis.");
      return;
    }

    setSubmitting(true);
    const result = await submitKyc({
      user_id: userId,
      target,
      full_name: fullName,
      phone,
      id_document_url: idDocumentUrl,
      shop_name: target === "seller" ? shopName : undefined,
      shop_description: target === "seller" ? shopDescription : undefined,
      vehicle_type: target === "courier" ? vehicleType : undefined,
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Erreur lors de l'envoi de votre dossier KYC.");
      return;
    }
    onSubmitted?.();
    setExisting({
      id: "temp",
      user_id: userId,
      target,
      full_name: fullName,
      phone,
      id_document_url: idDocumentUrl,
      status: "pending",
      created_at: new Date().toISOString(),
    });
  }

  if (existing === undefined) {
    return <div className="ac-skeleton" style={{ height: 220 }} />;
  }

  if (existing && existing.status === "pending") {
    return (
      <div className="ac-card ac-card--pad ac-text-center">
        <div style={{ fontSize: 34, marginBottom: 8 }}>🪪</div>
        <h3 className="ac-mb-8">Dossier KYC en cours d'examen</h3>
        <p className="ac-text-sm">
          Votre demande {target === "seller" ? "vendeur" : "coursier"} a bien été reçue. Un
          administrateur va l'examiner sous peu — vous serez notifié dès qu'elle sera validée.
        </p>
      </div>
    );
  }

  if (existing && existing.status === "rejected") {
    return (
      <div className="ac-card ac-card--pad">
        <div className="ac-alert ac-alert--danger">
          Votre précédente demande a été refusée
          {existing.admin_comment ? ` : ${existing.admin_comment}` : "."} Vous pouvez soumettre un
          nouveau dossier ci-dessous.
        </div>
        <KycForm
          userId={userId}
          target={target}
          fullName={fullName} setFullName={setFullName}
          phone={phone} setPhone={setPhone}
          idDocumentUrl={idDocumentUrl} setIdDocumentUrl={setIdDocumentUrl}
          shopName={shopName} setShopName={setShopName}
          shopDescription={shopDescription} setShopDescription={setShopDescription}
          vehicleType={vehicleType} setVehicleType={setVehicleType}
          error={error} submitting={submitting} onSubmit={handleSubmit}
        />
      </div>
    );
  }

  return (
    <div className="ac-card ac-card--pad">
      <h3 className="ac-mb-8">Validation KYC {target === "seller" ? "vendeur" : "coursier"}</h3>
      <p className="ac-text-sm ac-mb-8">
        Ces informations permettent à notre équipe de vérifier votre identité avant d'activer votre
        compte {target === "seller" ? "vendeur" : "coursier"}.
      </p>
      <KycForm
        userId={userId}
        target={target}
        fullName={fullName} setFullName={setFullName}
        phone={phone} setPhone={setPhone}
        idDocumentUrl={idDocumentUrl} setIdDocumentUrl={setIdDocumentUrl}
        shopName={shopName} setShopName={setShopName}
        shopDescription={shopDescription} setShopDescription={setShopDescription}
        vehicleType={vehicleType} setVehicleType={setVehicleType}
        error={error} submitting={submitting} onSubmit={handleSubmit}
      />
    </div>
  );
}

function KycForm(props: {
  userId: string;
  target: KycTarget;
  fullName: string; setFullName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  idDocumentUrl: string; setIdDocumentUrl: (v: string) => void;
  shopName: string; setShopName: (v: string) => void;
  shopDescription: string; setShopDescription: (v: string) => void;
  vehicleType: string; setVehicleType: (v: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      {props.error && <div className="ac-alert ac-alert--danger">{props.error}</div>}

      <div className="ac-field">
        <label className="ac-label">Nom complet (pièce d'identité)</label>
        <input className="ac-input" value={props.fullName} onChange={(e) => props.setFullName(e.target.value)} />
      </div>
      <div className="ac-field">
        <label className="ac-label">Téléphone</label>
        <input className="ac-input" value={props.phone} onChange={(e) => props.setPhone(e.target.value)} />
      </div>
      <FileUploader
        bucket="kyc"
        userId={props.userId}
        label="Justificatif d'identité (photo/scan)"
        accept="image/*,application/pdf"
        currentUrl={props.idDocumentUrl || undefined}
        onUploaded={(url) => props.setIdDocumentUrl(url)}
      />

      {props.target === "seller" && (
        <>
          <div className="ac-field">
            <label className="ac-label">Nom de la boutique</label>
            <input className="ac-input" value={props.shopName} onChange={(e) => props.setShopName(e.target.value)} />
          </div>
          <div className="ac-field">
            <label className="ac-label">Description de la boutique</label>
            <textarea className="ac-input" rows={3} value={props.shopDescription} onChange={(e) => props.setShopDescription(e.target.value)} />
          </div>
        </>
      )}

      {props.target === "courier" && (
        <div className="ac-field">
          <label className="ac-label">Type de véhicule</label>
          <select className="ac-select ac-full-width" value={props.vehicleType} onChange={(e) => props.setVehicleType(e.target.value)}>
            <option value="moto">Moto</option>
            <option value="velo">Vélo</option>
            <option value="voiture">Voiture</option>
            <option value="pied">À pied</option>
          </select>
        </div>
      )}

      <button className="ac-btn ac-btn--primary" disabled={props.submitting} onClick={props.onSubmit}>
        {props.submitting ? "Envoi…" : "Envoyer mon dossier KYC"}
      </button>
    </>
  );
}
