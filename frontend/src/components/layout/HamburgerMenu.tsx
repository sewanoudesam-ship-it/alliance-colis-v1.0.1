import { useState } from "react";
import type { Profile } from "../../types";
import { updateAvatar } from "../../services/profileService";
import FileUploader from "../shared/FileUploader";

type Props = {
  profile: Profile;
  onClose: () => void;
  onLogout: () => void;
  onBecomeSeller: () => void;
  onBecomeCourier: () => void;
  onProfileUpdated: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
};

export default function HamburgerMenu({ profile, onClose, onLogout, onBecomeSeller, onBecomeCourier, onProfileUpdated, onOpenTerms, onOpenPrivacy }: Props) {
  const [editingAvatar, setEditingAvatar] = useState(false);

  const initials = profile.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel: Record<Profile["role"], string> = {
    customer: "Client",
    seller_pending: "Vendeur (en attente de validation)",
    seller: "Vendeur",
    courier_pending: "Coursier (en attente de validation)",
    courier: "Coursier",
    admin: "Administrateur",
  };

  async function handleAvatarUploaded(url: string) {
    await updateAvatar(profile.id, url);
    setEditingAvatar(false);
    onProfileUpdated();
  }

  return (
    <>
      <div className="ac-overlay" onClick={onClose} />
      <div className="ac-drawer">
        <div className="ac-drawer__profile">
          <button
            className="ac-drawer__avatar"
            style={profile.avatar_url ? { padding: 0, overflow: "hidden" } : undefined}
            onClick={() => setEditingAvatar((v) => !v)}
            title="Changer ma photo"
          >
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
          </button>
          <div className="ac-flex-col">
            <strong>{profile.full_name}</strong>
            <span className="ac-text-sm">{roleLabel[profile.role]}</span>
          </div>
        </div>

        {editingAvatar && (
          <div className="ac-mb-8">
            <FileUploader bucket="avatars" userId={profile.id} label="Photo de profil" onUploaded={handleAvatarUploaded} />
          </div>
        )}

        {profile.role === "customer" && (
          <>
            <p className="ac-drawer__section-label">Devenir partenaire</p>
            <button className="ac-drawer__item" onClick={onBecomeSeller}>🏪 Devenir vendeur</button>
            <button className="ac-drawer__item" onClick={onBecomeCourier}>🛵 Devenir coursier</button>
          </>
        )}

        <p className="ac-drawer__section-label">Informations légales</p>
        <button className="ac-drawer__item" onClick={onOpenTerms}>📄 Conditions d'utilisation</button>
        <button className="ac-drawer__item" onClick={onOpenPrivacy}>🔒 Politique de confidentialité</button>
        <a className="ac-drawer__item" href="mailto:contact@alliancecolis.com">✉️ Contacter le service client</a>

        <p className="ac-drawer__section-label">Compte</p>
        <button className="ac-drawer__item ac-drawer__item--danger" onClick={onLogout}>🚪 Déconnexion</button>
      </div>
    </>
  );
}
