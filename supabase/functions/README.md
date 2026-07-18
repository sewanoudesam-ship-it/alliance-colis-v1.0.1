# Edge Functions — paiement SenePay

Deux fonctions gèrent l'intégralité du paiement mobile money, en gardant les
clés secrètes SenePay strictement côté serveur (jamais dans le frontend) :

| Fonction           | Rôle                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| `senepay-checkout` | Crée une session de paiement (Checkout hébergé) et renvoie `checkoutUrl`. |
| `senepay-webhook`  | Reçoit la notification signée de SenePay et confirme la commande.     |

## 1. Prérequis

```bash
npm install -g supabase
supabase login
supabase link --project-ref VOTRE_PROJECT_REF
```

## 2. Configurer les secrets (jamais dans le code, jamais dans le frontend)

```bash
supabase secrets set --env-file supabase/functions/.env
```

Le fichier `supabase/functions/.env` est **pré-rempli avec vos clés sandbox**
(reçues du marchand) et **exclu de git** (voir `supabase/.gitignore`).
Ne le committez jamais. Le jour du passage en production, remplacez-le par vos
clés `pk_live_` / `sk_live_` / `whsec_` puis relancez la commande ci-dessus.

## 3. Déployer

```bash
supabase functions deploy senepay-checkout
supabase functions deploy senepay-webhook --no-verify-jwt
```

`--no-verify-jwt` est nécessaire sur le webhook : c'est SenePay (pas un
utilisateur connecté) qui l'appelle — la sécurité est assurée par la
vérification de signature HMAC à l'intérieur de la fonction, pas par un JWT
Supabase.

## 4. Renseigner l'URL du webhook chez SenePay

Une fois déployée, notez l'URL affichée par `supabase functions deploy` :

```
https://VOTRE_PROJECT_REF.supabase.co/functions/v1/senepay-webhook
```

Cette URL est déjà transmise automatiquement à chaque session de paiement par
`senepay-checkout` (champ `webhookUrl`) — aucune configuration supplémentaire
n'est nécessaire dans le dashboard SenePay, sauf si vous souhaitez aussi
définir un webhook global par défaut dans **Api & Dev → Webhooks**.

## 5. Tester en local

```bash
supabase functions serve --env-file supabase/functions/.env
```

Utilisez les numéros de test sandbox listés dans la documentation SenePay
(§ 6, "Environnement de test") pour simuler un succès, un échec ou un paiement
en attente, par exemple `700000001` (Sénégal, succès) sur la page de checkout.

## 6. Passage en production réelle

1. Créez de vraies clés API sur sene-pay.com (`pk_live_...` / `sk_live_...`).
2. Remplacez le contenu de `supabase/functions/.env`.
3. Relancez `supabase secrets set --env-file supabase/functions/.env`.
4. Redéployez les deux fonctions.
5. Retestez un vrai petit paiement avant l'ouverture au public.
