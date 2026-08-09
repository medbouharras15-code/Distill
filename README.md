# Distill

Distill transforme vos notes de cours (texte, photo manuscrite ou PDF) en un
**résumé structuré** et des **flashcards de révision**, grâce à l'API Claude
d'Anthropic. Les utilisateurs créent un compte (Supabase), ont droit à 3
générations gratuites, puis peuvent s'abonner (9,99€/mois via Stripe) pour un
accès illimité.

## Démarrer le projet en local

**1. Installer les dépendances** (une seule fois) :

```bash
npm install
```

**2. Créer le fichier `.env.local`** à la racine du projet, avec ces
variables (voir plus bas comment obtenir chacune) :

```
ANTHROPIC_API_KEY=sk-ant-...

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

Ce fichier n'est jamais envoyé sur GitHub (ignoré par `.gitignore`) : vos
clés restent privées.

**3. Créer le schéma de base de données Supabase** : dans le dashboard
Supabase → SQL Editor, copiez-collez le contenu de `supabase/schema.sql` et
exécutez-le. Cela crée la table `profiles` (une ligne par utilisateur) avec
les bonnes règles de sécurité.

**4. Lancer le serveur de développement :**

```bash
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

## Comment ça marche

- **Comptes utilisateurs** (Supabase Auth, email + mot de passe) :
  `src/app/signup`, `src/app/login`, `src/middleware` (rafraîchit la
  session), `src/lib/supabase/*` (clients navigateur / serveur / admin).
- **Base de données** : une table `profiles` (voir `supabase/schema.sql`)
  stocke le compteur de générations gratuites et le statut d'abonnement de
  chaque utilisateur.
- **Génération** (`src/app/api/distill/route.ts`) : vérifie que
  l'utilisateur est connecté, vérifie sa limite gratuite, appelle l'API
  Claude, puis incrémente son compteur.
- **Abonnement Stripe** : `src/app/api/stripe/checkout` crée une session de
  paiement, `src/app/api/stripe/portal` ouvre la gestion de l'abonnement, et
  `src/app/api/stripe/webhook` reçoit les événements Stripe (paiement
  réussi, annulation, ...) pour mettre à jour Supabase.
- **Interface** (`src/components/DistillApp.tsx`) : formulaire de
  distillation, compteur de générations restantes, bouton d'abonnement,
  résultat en onglets Résumé / Flashcards.

## Limites de cette version

- Les photos sont automatiquement redimensionnées et compressées avant
  l'envoi. Les PDF sont limités à 3 Mo.
- 3 générations gratuites **à vie** par compte ; au-delà, abonnement requis.
