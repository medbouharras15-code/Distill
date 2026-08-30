# Icônes réalistes de la toolbar Notes

Ce dossier reçoit les illustrations réalistes/3D des outils de dessin. Le
code (`src/lib/notes/toolIconAssets.ts`) pointe déjà vers les 8 fichiers
ci-dessous — il suffit de déposer un fichier au bon nom pour qu'il
s'affiche immédiatement à la place de l'icône SVG plate, sans toucher au
code. Tant qu'un fichier est absent (ou ne charge pas), le repli SVG reste
utilisé automatiquement : aucun risque de casser la barre en cours de route.

## Fichiers attendus

| Outil        | Fichier                  |
| ------------ | ------------------------ |
| Stylo plume  | `pen-fineliner.webp`     |
| Stylo bille  | `pen-ballpoint.webp`     |
| Crayon       | `pen-crayon.webp`        |
| Surligneur   | `highlighter.webp`       |
| Gomme        | `eraser.webp`            |
| Règle        | `ruler.webp`             |
| Lasso        | `lasso.webp`             |
| Note         | `note.webp`              |

`.png` fonctionne aussi — dans ce cas, changer l'extension du chemin
correspondant dans `toolIconAssets.ts`.

## Gabarit recommandé (pour un rendu cohérent entre les 8 icônes)

- **Format** : PNG ou WebP, fond **transparent** (pas de fond blanc/carré).
- **Canevas carré**, 512×512px conseillé (toutes les icônes doivent partager
  exactement le même ratio — sinon leur taille visuelle finale diffère une
  fois affichées côte à côte, même si le composant les recadre proprement).
- **Cadrage** : l'objet centré, occupant environ 75–85% de la largeur/hauteur
  du canevas, avec une marge similaire d'une icône à l'autre — un stylo qui
  remplit tout le cadre à côté d'une gomme qui n'en occupe que la moitié se
  verra immédiatement comme incohérent.
- **Angle et lumière cohérents** : même angle de prise de vue (ex. ~30–40°,
  objet posé en diagonale) et même style d'éclairage/ombre douce sur
  l'ensemble du set, pour que les 8 icônes se lisent comme une seule famille
  visuelle plutôt que 8 rendus disparates.
- **Style** : rendu réaliste/3D, fini premium (métal/laque/bois selon
  l'outil), pas de style cartoon/flat — c'est justement ce qui les distingue
  du repli SVG.

L'affichage applique `object-contain` avec une légère marge interne : un
fichier qui respecte ce gabarit s'alignera automatiquement avec les autres,
sans réglage supplémentaire dans le code.
