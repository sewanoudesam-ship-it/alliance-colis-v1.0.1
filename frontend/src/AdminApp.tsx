import useAuth from "./hooks/useAuth";
import useProfile from "./hooks/useProfile";
import AdminAuthGate from "./components/admin/AdminAuthGate";
import AdminDashboard from "./components/admin/AdminDashboard";
import logo from "./assets/logo.png";

export default function AdminApp() {
  const { user, initializing, logout } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);

  if (initializing || (user && profileLoading)) {
    return (
      <div className="ac-app">
        <div className="ac-main">
          <div className="ac-skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (!user) return <AdminAuthGate />;

  // Un compte authentifié mais non-admin (client, vendeur, coursier) ne doit
  // jamais accéder au tableau de bord — refus explicite, pas de fuite d'info.
  if (profile && profile.role !== "admin") {
    return (
      <div className="ac-auth" style={{ background: "#0F0B1C" }}>
        <div className="ac-auth__card ac-text-center">
          <div style={{ fontSize: 34, marginBottom: 10 }}>⛔</div>
          <h1 className="ac-auth__title">Accès refusé</h1>
          <p className="ac-text-sm ac-mb-8">
            Ce compte ({profile.email}) n'a pas de droits administrateur.
          </p>
          <button className="ac-btn ac-btn--outline" onClick={logout}>Se déconnecter</button>
          <p className="ac-auth__link" onClick={() => (window.location.href = "/")}>
            Retour au site principal
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-app">
      <header className="ac-header" style={{ background: "#0F0B1C" }}>
        <div className="ac-header__bar">
          <div className="ac-header__brand">
            <img src={logo} alt="Alliance Colis" width={28} height={28} />
            <span>Alliance Colis · Admin</span>
          </div>
          <button className="ac-btn ac-btn--sm ac-btn--outline" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }} onClick={logout}>
            Déconnexion
          </button>
        </div>
        <div className="ac-diamond-strip" />
      </header>

      <main className="ac-main">
        {profile ? (
          <AdminDashboard />
        ) : (
          <div className="ac-empty">
            <div className="ac-empty__icon">⏳</div>
            <div className="ac-empty__title">Chargement…</div>
          </div>
        )}
      </main>
    </div>
  );
}
