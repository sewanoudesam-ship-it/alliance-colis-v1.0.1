/**
 * Contenu juridique centralisé — modifiable ici sans toucher au reste de
 * l'application. Toute mise à jour du texte doit s'accompagner d'un
 * incrément de TERMS_VERSION pour que les comptes déjà inscrits puissent,
 * plus tard, être invités à re-accepter la nouvelle version si nécessaire.
 */
export const TERMS_VERSION = "1.0.0";
export const TERMS_LAST_UPDATED = "20 juillet 2026";

export const TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Objet",
    body: "Les présentes Conditions d'utilisation régissent l'accès et l'usage de la plateforme Alliance Colis (marketplace et livraison locale), accessible via le site et l'application. En créant un compte, vous acceptez sans réserve ces conditions.",
  },
  {
    title: "2. Comptes utilisateurs",
    body: "Chaque utilisateur (client, vendeur, coursier) est responsable de l'exactitude des informations fournies lors de son inscription et de la confidentialité de ses identifiants de connexion.",
  },
  {
    title: "3. Vendeurs et coursiers",
    body: "L'accès aux fonctionnalités vendeur et coursier est soumis à une vérification d'identité (KYC) et à une validation par l'équipe Alliance Colis. Alliance Colis se réserve le droit de refuser ou suspendre un compte partenaire à tout moment en cas de non-respect des présentes conditions.",
  },
  {
    title: "4. Commandes et livraison",
    body: "Les commandes sont regroupées et acheminées depuis l'entrepôt Alliance Colis jusqu'au client final. Les délais de livraison sont estimatifs. Le tarif de livraison est calculé selon la distance entre l'entrepôt et l'adresse de livraison.",
  },
  {
    title: "5. Paiement",
    body: "Les paiements sont traités par un prestataire tiers spécialisé en paiement mobile money. Alliance Colis ne stocke aucune donnée bancaire ou de carte de paiement.",
  },
  {
    title: "6. Commissions",
    body: "Alliance Colis prélève une commission sur chaque vente réalisée par un vendeur (taux dégressif selon le volume de ventes) et sur chaque livraison effectuée par un coursier, conformément au barème en vigueur communiqué lors de l'inscription.",
  },
  {
    title: "7. Responsabilité",
    body: "Alliance Colis agit en tant qu'intermédiaire entre vendeurs, coursiers et clients. La responsabilité d'Alliance Colis ne saurait être engagée au-delà de la valeur de la commande concernée.",
  },
  {
    title: "8. Modification des conditions",
    body: "Alliance Colis peut modifier les présentes conditions à tout moment. Les utilisateurs seront informés de toute modification substantielle.",
  },
  {
    title: "9. Contact",
    body: "Pour toute question relative aux présentes conditions, contactez-nous à contact@alliancecolis.com.",
  },
];

export const PRIVACY_SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Données collectées",
    body: "Nous collectons les données que vous nous fournissez directement (nom, téléphone, email, adresse, pays) ainsi que, si vous l'autorisez, votre position géographique lors d'une commande, afin de calculer le tarif de livraison.",
  },
  {
    title: "2. Utilisation des données",
    body: "Vos données sont utilisées pour créer et gérer votre compte, traiter vos commandes, calculer les tarifs de livraison, assurer le suivi de vos colis, et vous contacter en cas de besoin lié à votre commande.",
  },
  {
    title: "3. Partage des données",
    body: "Vos données de livraison (adresse, position) sont partagées avec le coursier assigné à votre commande. Vos données de paiement transitent par notre prestataire de paiement mobile money et ne sont jamais stockées par Alliance Colis.",
  },
  {
    title: "4. Conservation",
    body: "Vos données sont conservées pendant toute la durée de votre compte, puis archivées conformément aux obligations légales applicables.",
  },
  {
    title: "5. Vos droits",
    body: "Vous pouvez demander l'accès, la rectification ou la suppression de vos données personnelles en nous contactant à contact@alliancecolis.com.",
  },
  {
    title: "6. Sécurité",
    body: "Les accès à votre compte et à vos données sont protégés (chiffrement, contrôle d'accès par rôle). Aucun système n'étant infaillible, nous vous invitons à choisir un mot de passe robuste et à ne pas le partager.",
  },
  {
    title: "7. Contact",
    body: "Pour toute question relative à la protection de vos données, contactez-nous à contact@alliancecolis.com.",
  },
];
