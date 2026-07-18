import { useRef, useState, type ChangeEvent } from "react";
import { supabase } from "../../lib/supabase";

type Bucket = "products" | "shops" | "avatars" | "kyc";

type Props = {
  bucket: Bucket;
  userId: string;
  label: string;
  accept?: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
};

const MAX_SIZE_MB = 5;

/**
 * Upload un fichier dans le bucket Supabase Storage indiqué, sous le chemin
 * "{userId}/{timestamp}-{nom}" (convention attendue par les policies RLS de
 * supabase/schema.sql, qui autorisent chaque utilisateur à écrire uniquement
 * dans son propre dossier).
 *
 * - "products" / "shops" / "avatars" sont des buckets publics : `onUploaded`
 *   reçoit une URL publique directement utilisable en <img src>.
 * - "kyc" est privé : `onUploaded` reçoit une URL signée valable 7 jours,
 *   suffisante pour l'examen par un administrateur juste après l'envoi. Pour un
 *   accès KYC à plus long terme côté admin, régénérer une URL signée à la volée
 *   (ex. depuis AdminDashboard) plutôt que de stocker l'URL signée elle-même.
 */
export default function FileUploader({ bucket, userId, label, accept = "image/*", currentUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Le fichier dépasse ${MAX_SIZE_MB} Mo.`);
      return;
    }

    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      setUploading(false);
      setError(`Échec de l'envoi : ${uploadError.message}`);
      return;
    }

    if (bucket === "kyc") {
      const { data, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 jours
      setUploading(false);
      if (signError || !data) {
        setError("Fichier envoyé, mais impossible de générer le lien de consultation.");
        return;
      }
      setPreview(data.signedUrl);
      onUploaded(data.signedUrl);
    } else {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setUploading(false);
      setPreview(data.publicUrl);
      onUploaded(data.publicUrl);
    }
  }

  const isImage = accept.startsWith("image");

  return (
    <div className="ac-field">
      <label className="ac-label">{label}</label>

      {preview && isImage && (
        <div className="ac-uploader__preview">
          <img src={preview} alt="Aperçu" />
        </div>
      )}
      {preview && !isImage && (
        <a className="ac-text-sm" href={preview} target="_blank" rel="noreferrer">📄 Fichier envoyé — voir ↗</a>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="ac-btn ac-btn--outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Envoi…" : preview ? "Remplacer le fichier" : "Choisir un fichier"}
      </button>

      {error && <p className="ac-text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
