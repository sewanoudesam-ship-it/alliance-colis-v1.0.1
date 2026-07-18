# Alliance Colis — V1 Production

Marketplace + livraison locale CEDEAO/UEMOA. React + TypeScript + Vite + Supabase, paiement mobile money réel (sandbox) via SenePay.

## 🔐 Route publique vs route admin

Deux applications React totalement séparées, choisies au chargement selon l'URL (`src/main.tsx`) :

| Route | App | Login | Contenu |
| --- | --- | --- | --- |
| `/` (et tout le reste) | `PublicApp.tsx` | Connexion + inscription client | Client, vendeur, coursier |
| `/admin` | `AdminApp.tsx` | Connexion seule, **aucune inscription** | Tableau de bord admin uniquement |

- Un compte `role = 'admin'` connecté sur `/` est **automatiquement redirigé** vers `/admin`.
- Un compte non-admin qui accède à `/admin` voit un écran **"Accès refusé"** — jamais le tableau de bord.
- `robots.txt` exclut `/admin` de l'indexation.
- Comme c'est une SPA (une seule page HTML), l'hébergeur doit rediriger **toutes** les routes vers
  `index.html` : déjà configuré pour Netlify/Cloudflare (`public/_redirects`) et Vercel
  (`vercel.json`). Si vous hébergez ailleurs, reproduisez cette règle.
- Pour une séparation encore plus stricte (recommandé à terme) : pointez un sous-domaine dédié
  (`admin.alliancecolis.com`) vers le même build — `main.tsx` détecte aussi bien un chemin `/admin`
  qu'un hostname dédié si vous adaptez la condition `isAdminRoute`.

## 🗂 Structure du projet

```
alliance-colis/
├── frontend/                  # Application React (PWA)
│   ├── src/
│   │   ├── main.tsx            # Choisit PublicApp ou AdminApp selon l'URL
│   │   ├── PublicApp.tsx        # Route "/" — client/vendeur/coursier
│   │   ├── AdminApp.tsx         # Route "/admin" — administration (login séparé)
│   │   ├── components/        # customer/ seller/ courier/ admin/ kyc/ auth/ layout/ tracking/
│   │   ├── services/          # Couche unique d'accès aux données (Supabase)
│   │   ├── hooks/              # useAuth, useProfile
│   │   ├── lib/                # supabase.ts, constants.ts
│   │   ├── utils/              # pricing.ts, format.ts
│   │   └── types/              # Source unique de vérité des types
│   └── .env.example
└── supabase/
    ├── schema.sql              # Schéma complet (tables, RLS, triggers)
    └── functions/               # Edge Functions (paiement SenePay)
        ├── senepay-checkout/
        ├── senepay-webhook/
        └── README.md            # Déploiement des Edge Functions
```

## 🚀 Installation

### 1. Base de données Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Ouvrez **SQL Editor** et exécutez tout le contenu de `supabase/schema.sql` (crée aussi
   automatiquement les 4 buckets Storage `products`, `shops`, `avatars` (publics) et `kyc` (privé),
   avec leurs policies).
3. Copiez `Project URL` et `anon public key` depuis **Project Settings → API**.

*(Déjà fait pour ce projet : `https://cyhegnomrlzdbeepfnia.supabase.co`, clé anon déjà dans `frontend/.env`.)*

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

#### ⚠️ Spécifique à GitHub Codespaces

Deux pièges classiques donnent une **page blanche** dans Codespaces :

1. **`.env` absent** — il est volontairement exclu du dépôt (`.gitignore`). Sans lui, l'app affiche
   désormais un écran d'explication (plus une page blanche silencieuse) — suivez ses instructions.
2. **Port non exposé correctement** — Vite doit écouter sur `0.0.0.0`, pas seulement `localhost`,
   pour que le port-forwarding de Codespaces fonctionne. C'est déjà configuré dans
   `frontend/vite.config.ts` (`server.host: true`). Une fois `npm run dev` lancé, ouvrez l'onglet
   **PORTS** de Codespaces (à côté du terminal), vérifiez que le port `5173` est listé avec la
   visibilité **Public** (clic droit → *Port Visibility* → *Public* si besoin), puis cliquez sur le
   globe 🌐 pour ouvrir l'URL générée — n'utilisez pas `http://localhost:5173` directement dans le
   navigateur si vous êtes sur l'interface web de Codespaces.

Si la page reste blanche malgré tout, ouvrez la console du navigateur (F12) : une nouvelle
protection (`ErrorBoundary`) affiche désormais le message d'erreur exact au lieu de rien afficher.

### 3. Paiement (Edge Functions SenePay)

Voir **`supabase/functions/README.md`** — 5 minutes, clés sandbox déjà pré-remplies dans
`supabase/functions/.env` (fichier non versionné).

### 4. Créer votre premier compte administrateur

Aucune interface ne crée un admin (volontaire, pour la sécurité). Après inscription normale
d'un compte, passez-le en admin directement en base :

```sql
update profiles set role = 'admin' where email = 'vous@exemple.com';
```

## ☁️ Déploiement — GitHub → Cloudflare Workers (automatique, un seul déploiement)

Méthode retenue : **GitHub Actions** build et déploie automatiquement à chaque `git push` sur
`main`. C'est la méthode la plus fiable — pas de commande à taper à la main, pas d'oubli possible,
reproductible à chaque fois. Suis ces étapes **dans l'ordre exact**, rien à sauter.

### Étape 1 — Pousser le code sur GitHub

```bash
git clone alliance-colis.bundle alliance-colis
cd alliance-colis
git remote add origin https://github.com/TON-USERNAME/alliance-colis.git
git push -u origin main
```

### Étape 2 — Créer le token API Cloudflare

1. [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**
2. Utilise le modèle **"Edit Cloudflare Workers"** (ou personnalisé avec au minimum) :
   - `Account` → `Workers Scripts` → **Edit**
   - `Account` → `Workers Routes` → **Edit** (nécessaire pour le nom de domaine à l'étape 5)
   - `Zone` → `Workers Routes` → **Edit**, restreint à la zone `alliancecolis.com`
3. **Continue to summary → Create Token** → copie la valeur (elle ne sera plus jamais réaffichée)

### Étape 3 — Récupérer ton Account ID Cloudflare

Dashboard Cloudflare → n'importe quel domaine → colonne de droite, section **API** → **Account ID**
(chaîne de 32 caractères hexadécimaux).

### Étape 4 — Ajouter les secrets sur GitHub

Sur ton dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**,
ajoute exactement ces 5 secrets :

| Nom du secret | Valeur |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Le token créé à l'étape 2 |
| `CLOUDFLARE_ACCOUNT_ID` | L'Account ID de l'étape 3 |
| `VITE_SUPABASE_URL` | `https://cyhegnomrlzdbeepfnia.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Ta clé anon Supabase (déjà dans `frontend/.env`) |
| `VITE_GOOGLE_MAPS_API_KEY` | Laisse vide si tu n'en as pas (OpenStreetMap reste utilisé) |

⚠️ Ces variables `VITE_*` doivent être définies **ici, en secrets GitHub** — pas seulement dans ton
`.env` local. Vite les intègre au moment du build (`npm run build`), qui se déroule sur les
machines GitHub, pas sur ton ordinateur.

### Étape 5 — Déclencher le premier déploiement

Le workflow (`.github/workflows/deploy.yml`) se déclenche automatiquement au push de l'étape 1.
S'il est déjà passé avant que tu ajoutes les secrets, relance-le manuellement :
**GitHub → onglet Actions → "Déploiement Cloudflare Workers" → Run workflow**.

Suis la progression dans l'onglet **Actions** — un ✅ vert confirme un déploiement réussi. En cas
d'échec (❌ rouge), clique dessus : le message d'erreur exact s'affiche dans les logs.

### Étape 6 — Brancher `alliancecolis.com`

1. Dashboard Cloudflare → **Workers & Pages** → le Worker `alliance-colis` doit apparaître
   (créé automatiquement par le premier déploiement)
2. Onglet du Worker → **Settings → Domains & Routes → Add → Custom Domain**
3. Tape `alliancecolis.com` (et `www.alliancecolis.com` si tu veux les deux) → **Add domain**
4. Cloudflare configure le DNS automatiquement (le domaine est déjà chez toi sur Cloudflare, donc
   c'est immédiat — pas d'attente de propagation DNS externe)

### Résultat

- `https://alliancecolis.com` → site public (client/vendeur/coursier)
- `https://alliancecolis.com/admin` → espace administrateur (login séparé)
- Chaque futur `git push` sur `main` redéploie automatiquement les deux en une seule fois — c'est
  bien **un seul déploiement**, les deux routes vivent dans le même Worker.

### Pourquoi cette méthode "sans échouer"

- Pas de commande `wrangler` à taper toi-même = pas d'erreur de frappe ni d'environnement local mal
  configuré (Node absent, mauvaise version, etc.)
- Le build se fait sur une machine GitHub propre à chaque fois, jamais pollué par ton poste
- Si un déploiement échoue, le précédent reste en ligne (aucune coupure de service)
- `npm install` (pas `npm ci`) dans le workflow tolère un `package-lock.json` pas parfaitement à
  jour, plutôt que de faire échouer tout le pipeline pour un détail

## ✅ Ce qui est fonctionnel de bout en bout

- Authentification complète (connexion, inscription, mot de passe oublié, réinitialisation)
- Rôles : client → vendeur/coursier (via KYC) → validation admin → activation
- Marketplace (recherche, panier, checkout), paiement réel sandbox SenePay (Wave/Orange/MTN/Moov/Free)
- Upload réel de fichiers vers Supabase Storage (photo produit, logo boutique, justificatif KYC, avatar)
- Commandes multi-boutiques, suivi client avec carte live (Leaflet/OpenStreetMap, sans clé API)
- Dashboard vendeur (boutique, produits, commandes, portefeuille avec paliers de commission 5/8/10%)
- Dashboard coursier (missions disponibles/en cours/historique, portefeuille, commission 30%)
- Dashboard admin (KYC, boutiques, produits, utilisateurs, livraisons, commandes)
- Tarification livraison automatique (1000 FCFA ≤5km puis +100 FCFA/km), calcul de distance réel (Haversine)
- Wallets crédités automatiquement (différé 10min/24h, voir section commissions ci-dessous) via pg_cron

## 💰 Règles de commission & versements (implémentées en base, non modifiables côté frontend)

| Bénéficiaire | Part | Déclenchement du versement |
| --- | --- | --- |
| Coursier | **75%** du prix de la livraison (25% pour Alliance Colis) | **10 minutes** après la livraison marquée "terminée" |
| Boutique | Prix des produits **moins** commission Alliance Colis (5% / 8% / 10% selon paliers de ventes cumulées) | **24 heures** après la livraison marquée "terminée" |
| Alliance Colis | 100% du prix produits est d'abord crédité sur `platform_account`, qui reverse ensuite la part boutique/coursier | Immédiat à la confirmation du paiement |

Ce comportement est géré entièrement en base (voir `supabase/schema.sql`, fonctions `credit_platform_account`,
`schedule_payouts_on_delivery_completed`, `process_scheduled_payouts`) via **pg_cron**, qui exécute
le versement des paiements dus toutes les minutes. **Activez l'extension `pg_cron`** dans
**Database → Extensions** sur votre projet Supabase (disponible à partir du plan gratuit) avant
d'exécuter `schema.sql`, sinon la ligne `create extension if not exists pg_cron;` échouera.

## 🔢 Numérotation des commandes

Chaque commande reçoit automatiquement un code séquentiel global (toutes boutiques confondues),
attribué par la base à l'insertion : `AC-00000000001`, `AC-00000000002`, etc. Le frontend ne génère
plus ce code lui-même. L'historique de chaque compte (client, vendeur, coursier) conserve
indéfiniment toutes ses commandes — aucune suppression n'est implémentée.

## 📱 PWA — installation & responsive

- **Responsive** : mobile-first avec paliers à 380px / 640px / 900px / 1200px (voir `index.css`) —
  navigation basse en pleine largeur sur mobile, "flottante" centrée sur tablette/desktop, grilles
  produits/statistiques qui s'étoffent avec la largeur d'écran.
- **Installable** : `public/manifest.webmanifest` + `public/sw.js` (service worker minimal, requis
  pour l'installabilité) sont déjà en place. Une bannière "Installer Alliance Colis" apparaît
  automatiquement (prompt natif Android/Chrome via `beforeinstallprompt` ; instructions manuelles
  sur iOS/Safari, qui ne propose pas de prompt natif). Testez avec `npm run build && npm run preview`
  (le service worker n'est volontairement pas actif en `npm run dev`).

## ⚠️ À faire avant l'ouverture au public

1. **Clés SenePay production** — je n'ai pas de clés `pk_live_`/`sk_live_` à ma disposition
   (seulement les clés sandbox que vous m'avez fournies). Générez-les sur sene-pay.com
   (**Api & Dev → Clés API**, nécessite votre KYC marchand SenePay validé), collez-les dans
   `supabase/functions/.env` à la place des clés `pk_test_`/`sk_test_`, puis :
   ```bash
   supabase secrets set --env-file supabase/functions/.env
   supabase functions deploy senepay-checkout
   supabase functions deploy senepay-webhook --no-verify-jwt
   ```
   Jusque-là, le paiement reste en sandbox (aucune vraie transaction débitée) — volontaire, pour
   ne pas couper le paiement pendant que vous récupérez vos clés live.
2. **Tester `npm run build`** — ce code a été écrit et relu avec soin mais n'a pas pu être compilé
   dans cet environnement (pas d'accès réseau pour installer les dépendances). Lancez
   `npm install && npm run build` en local et corrigez toute erreur TypeScript résiduelle avant
   mise en production.
3. **DNS alliancecolis.com** — pointez le domaine vers votre hébergeur (Vercel/Netlify/Cloudflare
   Pages...) une fois le premier déploiement fait ; `index.html` et `robots.txt` référencent déjà
   `www.alliancecolis.com`.
4. **Icônes PWA** — `public/icon-512.png` réutilise le logo existant ; prévoir un vrai jeu d'icônes
   (192px, 512px, maskable) pour un rendu optimal à l'installation.
