import { useEffect, useState } from "react";
import useAuth from "./hooks/useAuth";
import useProfile from "./hooks/useProfile";
import { getCart } from "./services/cartService";
import { requestRoleUpgrade } from "./services/profileService";
import AuthGate from "./components/auth/AuthGate";
import HamburgerMenu from "./components/layout/HamburgerMenu";
import RoleRouter from "./components/layout/RoleRouter";
import InstallBanner from "./components/layout/InstallBanner";
import PaymentReturn from "./components/customer/PaymentReturn";
import type { TabType } from "./types";
import logo from "./assets/logo.png";

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: "home", label: "Accueil", icon: "🏠" },
  { id: "market", label: "Marketplace", icon: "🛍️" },
  { id: "cart", label: "Panier", icon: "🛒" },
  { id: "tracking", label: "Suivi", icon: "📦" },
];

export default function App() {
  const { user, initializing, logout } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile(user?.id);

  const [tab, setTab] = useState<TabType>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const params = new URLSearchParams(window.location.search);
  const isPaymentReturn = params.has("payment_return");
  const isPaymentCancelled = params.has("payment_cancelled");

  useEffect(() => {
    if (user?.id) getCart(user.id).then((items) => setCartCount(items.length));
  }, [user?.id, tab]);

  function refreshCart() {
    if (user?.id) getCart(user.id).then((items) => setCartCount(items.length));
  }

  function clearPaymentReturnParams() {
    window.history.replaceState({}, "", window.location.pathname);
  }

  async function handleBecomeSeller() {
    if (!user) return;
    await requestRoleUpgrade(user.id, "seller");
    setMenuOpen(false);
    refreshProfile();
  }

  async function handleBecomeCourier() {
    if (!user) return;
    await requestRoleUpgrade(user.id, "courier");
    setMenuOpen(false);
    refreshProfile();
  }

  if (initializing || (user && profileLoading)) {
    return (
      <div className="ac-app">
        <div className="ac-main">
          <div className="ac-skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (!user) return <AuthGate />;

  return (
    <div className="ac-app">
      <header className="ac-header">
        <div className="ac-header__bar">
          <button className="ac-icon-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">☰</button>
          <div className="ac-header__brand">
            <img src={logo} alt="Alliance Colis" width={28} height={28} />
            <span>Alliance Colis</span>
          </div>
          <span className="ac-icon-btn" style={{ background: "transparent" }} />
        </div>
        <div className="ac-diamond-strip" />
      </header>

      <div style={{ paddingTop: 14 }}>
        <InstallBanner />
      </div>

      {menuOpen && profile && (
        <HamburgerMenu
          profile={profile}
          onClose={() => setMenuOpen(false)}
          onLogout={logout}
          onBecomeSeller={handleBecomeSeller}
          onBecomeCourier={handleBecomeCourier}
          onProfileUpdated={refreshProfile}
        />
      )}

      <main className="ac-main">
        {isPaymentReturn || isPaymentCancelled ? (
          <PaymentReturn
            userId={user.id}
            cancelled={isPaymentCancelled}
            onDone={() => {
              clearPaymentReturnParams();
              setTab("tracking");
            }}
          />
        ) : profile ? (
          <RoleRouter profile={profile} tab={tab} onCartChanged={refreshCart} />
        ) : (
          <div className="ac-empty">
            <div className="ac-empty__icon">⏳</div>
            <div className="ac-empty__title">Chargement de votre profil…</div>
          </div>
        )}
      </main>

      {profile?.role === "customer" && !isPaymentReturn && !isPaymentCancelled && (
        <nav className="ac-tabbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`ac-tabbar__item ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="ac-tabbar__icon">{t.icon}</span>
              {t.label}
              {t.id === "cart" && cartCount > 0 && (
                <span className="ac-tabbar__badge">{cartCount}</span>
              )}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
