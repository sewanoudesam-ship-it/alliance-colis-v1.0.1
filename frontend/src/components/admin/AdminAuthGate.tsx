import { useState } from "react";
import { supabase } from "../../lib/supabase";
import logo from "../../assets/logo.png";

export default function AdminAuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError("Renseignez votre email et votre mot de passe administrateur.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div className="ac-auth" style={{ background: "#0F0B1C" }}>
      <div className="ac-auth__card">
        <div className="ac-auth__logo">
          <img src={logo} alt="Alliance Colis" />
        </div>
        <h1 className="ac-auth__title">Administration</h1>
        <p className="ac-auth__subtitle">Alliance Colis — accès réservé</p>

        {error && <div className="ac-alert ac-alert--danger">{error}</div>}

        <div className="ac-field">
          <label className="ac-label">Email administrateur</label>
          <input className="ac-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@alliancecolis.com" />
        </div>
        <div className="ac-field">
          <label className="ac-label">Mot de passe</label>
          <input
            className="ac-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        <button className="ac-btn ac-btn--dark" disabled={loading} onClick={handleLogin}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>

        <p className="ac-text-sm ac-text-center ac-mt-16">
          Cet espace n'accepte aucune inscription. Les comptes administrateur sont créés
          manuellement en base par l'équipe technique.
        </p>
      </div>
    </div>
  );
}
