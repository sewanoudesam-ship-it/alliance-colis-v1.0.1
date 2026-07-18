import type { Profile, TabType } from "../../types";
import KycScreen from "../kyc/KycScreen";
import Marketplace from "../customer/Marketplace";
import Cart from "../customer/Cart";
import OrderTracking from "../customer/OrderTracking";
import SellerDashboard from "../seller/SellerDashboard";
import CourierDashboard from "../courier/CourierDashboard";

type Props = {
  profile: Profile;
  tab: TabType;
  onCartChanged: () => void;
};

/**
 * Routeur du site PUBLIC (client/vendeur/coursier) uniquement. L'espace
 * administrateur est une route séparée (/admin, voir AdminApp.tsx) : un compte
 * admin ne doit jamais transiter par ce routeur (voir la redirection dans App.tsx).
 */
export default function RoleRouter({ profile, tab, onCartChanged }: Props) {
  const { role, id: userId } = profile;

  if (role === "seller") return <SellerDashboard userId={userId} />;
  if (role === "courier") return <CourierDashboard userId={userId} />;

  if (role === "seller_pending") return <KycScreen userId={userId} target="seller" />;
  if (role === "courier_pending") return <KycScreen userId={userId} target="courier" />;

  // role === "customer" (ou valeur inattendue -> traité comme client par défaut)
  switch (tab) {
    case "market":
      return <Marketplace userId={userId} onAddedToCart={onCartChanged} />;
    case "cart":
      return <Cart userId={userId} onOrderPlaced={onCartChanged} />;
    case "tracking":
      return <OrderTracking userId={userId} />;
    case "home":
    default:
      return <CustomerHome profile={profile} />;
  }
}

function CustomerHome({ profile }: { profile: Profile }) {
  return (
    <div>
      <h1 className="ac-page-title">Bonjour {profile.full_name.split(" ")[0]} 👋</h1>
      <p className="ac-page-subtitle">Que souhaitez-vous faire aujourd'hui ?</p>

      <div className="ac-list">
        <div className="ac-card ac-card--pad">
          <p className="ac-section-title">Marketplace</p>
          <p className="ac-text-sm">Parcourez les produits des boutiques partenaires près de chez vous.</p>
        </div>
        <div className="ac-card ac-card--pad">
          <p className="ac-section-title">Livraison suivie</p>
          <p className="ac-text-sm">Suivez vos colis en temps réel, du vendeur jusqu'à votre porte.</p>
        </div>
        <div className="ac-card ac-card--pad">
          <p className="ac-section-title">Devenez partenaire</p>
          <p className="ac-text-sm">Ouvrez le menu ☰ pour demander à devenir vendeur ou coursier Alliance Colis.</p>
        </div>
      </div>
    </div>
  );
}
