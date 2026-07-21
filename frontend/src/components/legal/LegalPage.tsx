import { TERMS_LAST_UPDATED } from "../../lib/legalContent";
import logo from "../../assets/logo.png";

type Props = {
  title: string;
  sections: { title: string; body: string }[];
  onClose: () => void;
};

export default function LegalPage({ title, sections, onClose }: Props) {
  return (
    <div className="ac-app">
      <header className="ac-header">
        <div className="ac-header__bar">
          <button className="ac-icon-btn" onClick={onClose} aria-label="Retour">←</button>
          <div className="ac-header__brand">
            <img src={logo} alt="Alliance Colis" width={28} height={28} />
            <span>Alliance Colis</span>
          </div>
          <span className="ac-icon-btn" style={{ background: "transparent" }} />
        </div>
        <div className="ac-diamond-strip" />
      </header>

      <main className="ac-main">
        <h1 className="ac-page-title">{title}</h1>
        <p className="ac-page-subtitle">Dernière mise à jour : {TERMS_LAST_UPDATED}</p>

        <div className="ac-list">
          {sections.map((s) => (
            <div key={s.title} className="ac-card ac-card--pad">
              <p className="ac-section-title">{s.title}</p>
              <p className="ac-text-sm" style={{ lineHeight: 1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div className="ac-card ac-card--pad ac-mt-16 ac-text-center">
          <p className="ac-text-sm ac-mb-8">Une question ?</p>
          <a className="ac-btn ac-btn--outline" href="mailto:contact@alliancecolis.com">
            ✉️ Contacter le service client
          </a>
        </div>
      </main>
    </div>
  );
}
