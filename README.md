# Distill

Distill transforme vos notes de cours (texte, photo manuscrite ou PDF) en un
**résumé structuré** et des **flashcards de révision**, grâce à l'API Claude
d'Anthropic.

## Démarrer le projet en local

**1. Installer les dépendances** (une seule fois) :

```bash
npm install
```

**2. Ajouter votre clé API Claude.**

Créez un fichier nommé `.env.local` à la racine du projet (à côté de
`package.json`) et ajoutez-y cette ligne, en remplaçant par votre propre clé
(obtenue sur [console.anthropic.com](https://console.anthropic.com)) :

```
ANTHROPIC_API_KEY=sk-ant-votre-clé-ici
```

Ce fichier n'est jamais envoyé sur GitHub (il est ignoré par `.gitignore`) :
votre clé reste privée.

**3. Lancer le serveur de développement :**

```bash
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000) dans votre
navigateur.

## Comment ça marche

- La page d'accueil (`src/app/page.tsx` → `src/components/DistillApp.tsx`)
  affiche le formulaire : texte collé, photo, PDF, et le bouton "Distiller
  mes notes".
- Quand vous cliquez sur le bouton, le navigateur envoie votre contenu à la
  route serveur `src/app/api/distill/route.ts`.
- Cette route appelle l'API Claude (modèle `claude-sonnet-4-6`) avec un
  prompt qui demande un résumé structuré et 8 à 10 flashcards, au format
  JSON.
- Le résultat est ensuite affiché avec deux onglets : **Résumé** (rendu en
  Markdown avec titres et mots-clés en gras) et **Flashcards** (cartes
  cliquables qui se retournent pour révéler la réponse).

## Limites de cette version 1

- Pas de compte utilisateur, pas de paiement, pas de sauvegarde : chaque
  session est indépendante.
- Les photos sont automatiquement redimensionnées et compressées avant
  l'envoi (aucune limite pratique côté utilisateur). Les PDF sont limités à
  3 Mo, pour rester sous la limite de taille de requête de Vercel.
