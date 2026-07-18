import React from "react";
import ReactDOM from "react-dom/client";
import PublicApp from "./PublicApp";
import AdminApp from "./AdminApp";
import ErrorBoundary from "./ErrorBoundary";
import { isSupabaseConfigured } from "./lib/supabase";
import "./index.css";
import "leaflet/dist/leaflet.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Échec d'enregistrement du service worker :", err);
    });
  });
}

function MissingEnvScreen() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "system-ui, sans-serif", background: "#1C1730", color: "#fff",
    }}>
      <div style={{ maxWidth: 480, background: "#fff", color: "#1C1730", borderRadius: 16, padding: 28 }}>
        <h1 style={{ fontSize: 20, marginBottom: 10 }}>⚠️ Configuration manquante</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
          Le fichier <code>frontend/.env</code> est introuvable ou incomplet. C'est normal juste après
          un <code>git clone</code> : ce fichier contient des identifiants et n'est jamais versionné
          (voir <code>.gitignore</code>).
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
          Pour le créer :
        </p>
        <pre style={{ background: "#F1ECE3", padding: 12, borderRadius: 8, fontSize: 12.5, overflowX: "auto" }}>
{`cd frontend
cp .env.example .env
# puis renseignez VITE_SUPABASE_URL et
# VITE_SUPABASE_ANON_KEY dans .env`}
        </pre>
        <p style={{ fontSize: 13, marginTop: 14, color: "#565070" }}>
          Redémarrez ensuite <code>npm run dev</code> (Vite ne recharge pas automatiquement les
          variables d'environnement).
        </p>
      </div>
    </div>
  );
}

const isAdminRoute = window.location.pathname.startsWith("/admin");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isSupabaseConfigured ? (isAdminRoute ? <AdminApp /> : <PublicApp />) : <MissingEnvScreen />}
    </ErrorBoundary>
  </React.StrictMode>
);
