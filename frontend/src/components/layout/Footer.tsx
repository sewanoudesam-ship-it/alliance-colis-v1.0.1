type Props = {
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  variant?: "light" | "dark";
};

export default function Footer({ onOpenTerms, onOpenPrivacy, variant = "light" }: Props) {
  return (
    <footer className={`ac-footer ${variant === "dark" ? "ac-footer--dark" : ""}`}>
      <div className="ac-footer__links">
        <button onClick={onOpenTerms}>Conditions d'utilisation</button>
        <span>·</span>
        <button onClick={onOpenPrivacy}>Politique de confidentialité</button>
        <span>·</span>
        <a href="mailto:contact@alliancecolis.com">Contact</a>
      </div>
      <p className="ac-footer__copy">© Alliance Colis {new Date().getFullYear()}</p>
    </footer>
  );
}
