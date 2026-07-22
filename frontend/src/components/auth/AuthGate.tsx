import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { COUNTRIES } from "../../lib/constants";
import { TERMS_VERSION, TERMS_SECTIONS, PRIVACY_SECTIONS } from "../../lib/legalContent";
import LegalPage from "../legal/LegalPage";
import Footer from "../layout/Footer";
import logo from "../../assets/logo.png";
import type { AuthError } from "@supabase/supabase-js";

/**
 * Convertit une erreur Supabase Auth en message lisible. Filet de sécurité
 * pour les erreurs mal formées côté serveur (ex : 500 "Error sending
 * recovery email" quand le SMTP du projet est mal configuré, qui peut
 * remonter sans message exploitable).
 */
function friendlyAuthError(error: AuthError | Error): string {
  const raw = error.message?.trim();
  if (!raw || raw === "{}" || raw.length < 3) {
    return "Une erreur est survenue côté serveur (souvent : l'envoi d'email n'est pas configuré). Réessayez dans un instant ou contactez le support.";
  }
  if (raw.toLowerCase().includes("email rate limit")) {
    return "Trop de tentatives récentes pour cet email. Réessayez dans quelques minutes.";
  }
  return raw;
}

type View = "login" | "signup" | "forgot" | "reset";
type LegalView = "terms" | "privacy" | null;

export default function AuthGate() {
  const [view, setView] = useState<View>("login");
  const [legalView, setLegalView] = useState<LegalView>(null);
  const [message, setMessage] = useState<{ type: "danger" | "success" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("CI");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setView("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function resetMessage() {
    setMessage(null);
  }

  async function handleLogin() {
    resetMessage();
    if (!email || !password) {
      setMessage({ type: "danger", text: "Veuillez renseigner votre email et votre mot de passe." });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMessage({ type: "danger", text: friendlyAuthError(error) });
  }

  async function handleSignup() {
    resetMessage();
    if (!fullName || !phone || !email || !password) {
      setMessage({ type: "danger", text: "Veuillez remplir tous les champs." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "danger", text: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }
    if (!termsAccepted) {
      setMessage({ type: "danger", text: "Vous devez accepter les Conditions d'utilisation pour continuer." });
      return;
    }

    setLoading(true);
    const selected = COUNTRIES.find((c) => c.code === country);
    const fullPhone = `${selected?.prefix ?? ""}${phone}`;

    // La ligne "profiles" (y compris l'acceptation des CGU horodatée) est
    // créée automatiquement côté base par le trigger SQL handle_new_user(),
    // à partir des métadonnées passées ici.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: fullPhone,
          country,
          terms_accepted: true,
          terms_version: TERMS_VERSION,
        },
      },
    });

    if (error) {
      setLoading(false);
      setMessage({ type: "danger", text: friendlyAuthError(error) });
      return;
    }

    setLoading(false);
    setMessage({ type: "success", text: "Compte créé avec succès. Vous pouvez vous connecter." });
    setView("login");
  }

  async function handleForgotPassword() {
    resetMessage();
    if (!email) {
      setMessage({ type: "danger", text: "Renseignez votre email pour recevoir le lien de réinitialisation." });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) {
      setMessage({ type: "danger", text: friendlyAuthError(error) });
      return;
    }
    setMessage({ type: "success", text: "Un lien de réinitialisation vient de vous être envoyé par email." });
  }

  async function handleResetPassword() {
    resetMessage();
    if (newPassword.length < 6) {
      setMessage({ type: "danger", text: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setMessage({ type: "danger", text: friendlyAuthError(error) });
      return;
    }
    setMessage({ type: "success", text: "Mot de passe mis à jour. Vous êtes connecté." });
  }

  if (legalView === "terms") {
    return <LegalPage title="Conditions d'utilisation" sections={TERMS_SECTIONS} onClose={() => setLegalView(null)} />;
  }
  if (legalView === "privacy") {
    return <LegalPage title="Politique de confidentialité" sections={PRIVACY_SECTIONS} onClose={() => setLegalView(null)} />;
  }

  return (
    <div className="ac-auth" style={{ flexDirection: "column", height: "auto", minHeight: "100vh" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <div className="ac-auth__card">
          <div className="ac-auth__logo">
            <img src={logo} alt="Alliance Colis" />
          </div>
          <h1 className="ac-auth__title">Alliance Colis</h1>
          <p className="ac-auth__subtitle">Marketplace &amp; livraison locale CEDEAO/UEMOA</p>

          {message && <div className={`ac-alert ac-alert--${message.type}`}>{message.text}</div>}

          {(view === "login" || view === "signup") && (
            <>
              <div className="ac-auth__switch">
                <button className={view === "login" ? "active" : ""} onClick={() => { setView("login"); resetMessage(); }}>
                  Connexion
                </button>
                <button className={view === "signup" ? "active" : ""} onClick={() => { setView("signup"); resetMessage(); }}>
                  Créer un compte
                </button>
              </div>

              {view === "signup" && (
                <>
                  <div className="ac-field">
                    <label className="ac-label">Nom complet</label>
                    <input className="ac-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex : Awa Traoré" />
                  </div>
                  <div className="ac-field">
                    <label className="ac-label">Pays &amp; téléphone</label>
                    <div className="ac-input-group">
                      <select className="ac-select" value={country} onChange={(e) => setCountry(e.target.value)}>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.prefix} {c.code}</option>
                        ))}
                      </select>
                      <input className="ac-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="XX XX XX XX" />
                    </div>
                  </div>
                </>
              )}

              <div className="ac-field">
                <label className="ac-label">Email</label>
                <input className="ac-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
              </div>
              <div className="ac-field">
                <label className="ac-label">Mot de passe</label>
                <input className="ac-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>

              {view === "signup" && (
                <div className="ac-checkbox-row">
                  <input
                    type="checkbox"
                    id="terms-checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  <label htmlFor="terms-checkbox">
                    J'ai lu et j'accepte les{" "}
                    <a onClick={(e) => { e.preventDefault(); setLegalView("terms"); }} href="#">Conditions d'utilisation</a>
                    {" "}ainsi que la{" "}
                    <a onClick={(e) => { e.preventDefault(); setLegalView("privacy"); }} href="#">Politique de confidentialité</a>
                    {" "}d'Alliance Colis.
                  </label>
                </div>
              )}

              <button
                className="ac-btn ac-btn--primary"
                disabled={loading || (view === "signup" && !termsAccepted)}
                onClick={view === "login" ? handleLogin : handleSignup}
              >
                {loading ? "Veuillez patienter…" : view === "login" ? "Se connecter" : "Créer mon compte client"}
              </button>

              {view === "login" && (
                <p className="ac-auth__link" onClick={() => { setView("forgot"); resetMessage(); }}>
                  Mot de passe oublié ?
                </p>
              )}
            </>
          )}

          {view === "forgot" && (
            <>
              <div className="ac-field">
                <label className="ac-label">Email</label>
                <input className="ac-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
              </div>
              <button className="ac-btn ac-btn--primary" disabled={loading} onClick={handleForgotPassword}>
                {loading ? "Envoi…" : "Recevoir le lien de réinitialisation"}
              </button>
              <p className="ac-auth__link" onClick={() => { setView("login"); resetMessage(); }}>
                Retour à la connexion
              </p>
            </>
          )}

          {view === "reset" && (
            <>
              <p className="ac-text-sm ac-mb-8">Choisissez votre nouveau mot de passe.</p>
              <div className="ac-field">
                <label className="ac-label">Nouveau mot de passe</label>
                <input className="ac-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button className="ac-btn ac-btn--primary" disabled={loading} onClick={handleResetPassword}>
                {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </button>
            </>
          )}
        </div>
      </div>
      <Footer variant="dark" onOpenTerms={() => setLegalView("terms")} onOpenPrivacy={() => setLegalView("privacy")} />
    </div>
  );
}
