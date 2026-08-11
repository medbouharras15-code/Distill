# Distill

Distill transforme vos notes de cours (texte, photo manuscrite ou PDF) en un
**résumé structuré** et des **flashcards de révision**, grâce à l'API Claude
d'Anthropic. Les utilisateurs créent un compte (Supabase), ont droit à 3
générations gratuites, puis peuvent s'abonner (9,99€/mois via Lemon Squeezy)
pour un accès illimité.

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

LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_VARIANT_ID=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
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
- **Abonnement Lemon Squeezy** : `src/app/api/lemonsqueezy/checkout` crée un
  checkout et renvoie le lien vers la page hébergée par Lemon Squeezy (la
  carte bancaire n'y transite jamais par notre serveur),
  `src/app/api/lemonsqueezy/cancel` annule l'abonnement, et
  `src/app/api/lemonsqueezy/webhook` reçoit les événements Lemon Squeezy
  (création, mise à jour, annulation, ...) pour mettre à jour Supabase.
- **Interface** (`src/components/DistillApp.tsx`) : formulaire de
  distillation, compteur de générations restantes, bouton d'abonnement,
  résultat en onglets Résumé / Flashcards.
- **Notes à main levée** (`/notes`, en construction — voir
  `docs/notes-module.md`) : éditeur façon Notability/GoodNotes avec l'IA de
  Distill intégrée. `src/components/notes/*` (canvas, barre d'outils),
  `src/lib/notes/*` (types, moteur de dessin). Actuellement disponible :
  canvas avec stylo (couleurs/tailles/types), gomme, annuler/rétablir.

## Limites de cette version

- Les photos sont automatiquement redimensionnées et compressées avant
  l'envoi. Les PDF sont limités à 3 Mo.
- 3 générations gratuites **à vie** par compte ; au-delà, abonnement requis.
- Le module Notes à main levée est en cours de construction par phases (voir
  `docs/notes-module.md`) : la sauvegarde, l'IA, l'export et la
  collaboration ne sont pas encore implémentés.
