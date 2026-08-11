# Module "Notes à main levée"

Éditeur de notes façon Notability/GoodNotes intégré à Distill, avec l'IA de
Distill utilisable directement sur les pages manuscrites. Spécifié dans le
cahier des charges fourni par l'équipe produit ; construit par phases dans
l'ordre suggéré par ce document.

Code : `src/app/notes/`, `src/components/notes/`, `src/lib/notes/`.

## Avancement

- [x] **Phase 1 — Canvas de base** : canvas HTML5 (Pointer Events, souris /
      tactile / stylet + pression), traits stockés en vecteurs, stylo (3
      pastilles rapides + palette complète via color picker natif, 3 types
      dont un feutre pinceau sensible à la pression), surligneur séparé
      (rendu semi-transparent "multiply", 4 couleurs rapides + palette
      complète), gomme avec icône dédiée (bouton + double-clic sur le stylo
      pour bascule rapide avec retour automatique à l'outil précédent),
      système de 5 tailles en pastilles visuelles (stylo, surligneur, gomme),
      icônes SVG maison (`src/components/notes/icons.tsx`), barre d'outils
      sur une seule ligne (scroll horizontal si nécessaire), annuler/rétablir,
      rejet de paume (~750 ms après une entrée stylet), `touchAction: none`.
      Bascule rapide vers la gomme par trois voies équivalentes : bouton
      dédié dans la barre d'outils, double-clic sur l'icône stylo, ou
      double-tap de la pointe du stylet directement sur la feuille (un tap
      isolé reste un simple point d'encre ; retour automatique à l'outil
      précédent après une gomme). *Note : le bouton **latéral** de l'Apple
      Pencil (pression/squeeze) reste hors de portée d'une page web —
      Safari/WebKit n'expose pas l'API `UIPencilInteraction` aux sites,
      réservée aux apps natives ; le double-tap de la pointe est
      l'équivalent le plus proche accessible depuis le navigateur.*
- [x] **Phase 2 — Sélecteur de feuilles** : les 16 types requis
      (`src/lib/notes/sheets.ts`), rendus fidèlement sur le canvas
      (`drawSheetPattern` dans `canvasUtils.ts`) et dans des vignettes
      d'aperçu qui réutilisent le même moteur de rendu
      (`SheetPreview.tsx`). Sélecteur plein écran avant la première page
      (`SheetSelector.tsx`), réouvrable ensuite depuis un bouton d'état
      ("Cornell Note · A4") qui ouvre le même sélecteur en modal. 3 formats
      de papier (Letter/A4/A5, vraies proportions), 4 couleurs de fond
      (blanc/crème/gris clair/noir). *Note : sur fond noir, l'encre ne
      s'adapte pas encore automatiquement (encre par défaut peu lisible) —
      l'adaptation de couleur d'encre au mode nuit est explicitement prévue
      en phase 8 ("Confort visuel"), pas avant. En attendant, choisir une
      couleur de stylo claire via la palette complète.*
- [ ] **Phase 3** — Marqueur (6 couleurs rapides + palette 64, rendu
      "multiply"), formes géométriques + détection automatique, trait qui se
      redresse automatiquement.
- [ ] **Phase 4** — Import de photos (redimensionnables), zoom/dézoom.
- [ ] **Phase 5** — Outil texte "Tt" + clavier auto, outil lasso (sélection /
      déplacement / redimensionnement).
- [ ] **Phase 6** — Historique et sauvegarde : persistance Supabase,
      sauvegarde auto, titres générés par IA, scroll mémorisé par page, écran
      d'historique (vignettes, regroupement par carnet, recherche), recherche
      OCR dans les notes manuscrites.
- [ ] **Phase 7** — Fonctionnalités IA : étiquetage automatique par matière,
      résumé/flashcards depuis une page manuscrite (OCR vision), fiche de
      révision multi-pages (option manuelle), détection de flashcards à la
      volée.
- [ ] **Phase 8** — Minuteur visible, compteur de révisions (discret), pages
      épinglées/favoris.
- [ ] **Phase 9** — Export PDF du carnet, impression optimisée, partage par
      lien, mode présentation plein écran.
- [ ] **Phase 10** — Groupe de classe privé (fiches de révision partagées
      entre membres d'un même cours).
- [ ] **Phase 11** — Polish design : mode nuit, couleurs de reliure par
      carnet, finitions chic (ombres, coins arrondis, transitions).

## Modèle de données cible

```ts
interface NotePage {
  id: string;
  title: string;           // généré par l'IA
  sheetType: SheetType;
  paperSize: PaperSize;
  backgroundColor: string;
  strokes: Stroke[];
  shapes: ShapeElement[];
  textBoxes: TextBoxElement[];
  images: ImageElement[];
  lastScrollPosition: number;
  reviewCount: number;
  pinned: boolean;
  subject: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Notebook {
  id: string;
  name: string;
  color: string;           // couleur de reliure
  subject: string | null;
  pages: NotePage[];
}
```

Défini dans `src/lib/notes/types.ts`. La persistance (table Supabase,
Storage pour les images) arrive en phase 6 — pour l'instant tout est en
mémoire côté client (rien n'est encore sauvegardé).

## Notes techniques

- Rendu canvas imperatif (pas de re-render React pendant le tracé) : les
  points sont accumulés dans une ref pendant `pointermove`, redessinés via
  `requestAnimationFrame`, et l'état React n'est mis à jour qu'une fois le
  trait terminé (`pointerup`) — pour l'historique annuler/rétablir.
- Page logique dont les dimensions dépendent du format choisi
  (`getPageDimensions` dans `sheets.ts` : grand côté fixé à 1100px, petit
  côté dérivé du vrai ratio Letter/A4/A5), mise à l'échelle en CSS ; les
  coordonnées de pointeur sont reprojetées dans l'espace logique pour
  rester stables quel que soit le zoom du conteneur. A4 et A5 partagent le
  même ratio (feuilles ISO) donc s'affichent à l'identique à l'écran — la
  différence de taille réelle ne comptera qu'à l'export/impression (phase 9).
- Gomme : suppression au niveau du trait entier (pas de gomme pixel) — un
  trait est retiré dès qu'un de ses segments passe à moins du rayon de
  gomme choisi.
