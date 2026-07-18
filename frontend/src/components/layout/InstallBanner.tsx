import useInstallPrompt from "../../hooks/useInstallPrompt";
import logo from "../../assets/logo.png";

export default function InstallBanner() {
  const { canPromptAndroid, shouldShowIosHint, promptInstall, dismiss } = useInstallPrompt();

  if (!canPromptAndroid && !shouldShowIosHint) return null;

  return (
    <div className="ac-install-banner">
      <img src={logo} alt="" width={40} height={40} />
      <div className="ac-install-banner__text">
        <strong>Installer Alliance Colis</strong>
        <span>
          {canPromptAndroid
            ? "Accès rapide depuis votre écran d'accueil, comme une vraie application."
            : "Sur Safari : appuyez sur Partager, puis « Sur l'écran d'accueil »."}
        </span>
      </div>
      <div className="ac-install-banner__actions">
        {canPromptAndroid && (
          <button className="ac-btn ac-btn--primary ac-btn--sm" onClick={promptInstall}>Installer</button>
        )}
        <button className="ac-icon-btn ac-install-banner__close" onClick={dismiss} aria-label="Fermer">✕</button>
      </div>
    </div>
  );
}
