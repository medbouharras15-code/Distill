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
- [x] **Phase 3 — Formes et trait auto** : le marqueur/surligneur (rendu
      "multiply", couleurs rapides + palette complète) était déjà livré en
      phase 1 (fusionné avec "surligneur" à la demande explicite). Ajouté
      cette phase :
      - **Outil Formes dédié** (`src/components/notes/icons.tsx` :
        `ShapesIcon` + icônes par type) : cercle, rectangle, triangle,
        ligne, dessinés par glisser-déposer (couleur + épaisseur de trait
        au choix, 5 tailles). Rendu et détection de collision (gomme) dans
        `canvasUtils.ts` (`drawShape`, `shapeHitTest`).
      - **Détection automatique de formes façon PencilKit** (`src/lib/notes/shapeDetection.ts`) :
        en dessinant au stylo normal, si le tracé ressemble à un cercle, un
        rectangle ou une ligne droite ET que le stylet reste immobile
        ~600ms sans être levé, le trait à main levée se redresse en forme
        propre. Si on lève le stylet avant ce délai, le trait reste à main
        levée tel quel — y compris pour souligner du texte : un
        soulignement rapide sans pause n'est jamais redressé, il faut
        marquer un temps d'arrêt à la fin du geste. *(Une version qui
        redressait la ligne sur simple lever de stylet, sans maintien, a
        été essayée puis retirée à la demande explicite : le risque de
        redresser des traits de lettres normales pendant l'écriture
        n'était pas acceptable — le comportement final applique donc le
        même geste de maintien aux trois formes.)*
      - Le délai d'immobilité (`DEFAULT_HOLD_TO_SNAP_MS`, 600ms) est
        exposé comme prop `holdToSnapMs` sur `NotesCanvas` pour rester
        ajustable sans toucher au moteur de détection.
      - **Animation de transition** (`SNAP_ANIMATION_MS`, 220ms, ease-out
        cubique) : au lieu d'un remplacement brutal, chaque point du tracé
        à main levée migre en douceur vers sa position sur la forme propre
        (`computeSnapTargets` — projection par angle sur l'ellipse pour le
        cercle, projection sur le bord le plus proche pour le rectangle,
        répartition uniforme le long du segment pour la ligne), pendant que
        le stylet est encore maintenu appuyé.
      - Un tracé rapide sans maintien (griffonnage normal, écriture) n'est
        jamais transformé — seul un maintien explicite déclenche la
        reconnaissance, pour ne jamais interférer avec l'écriture normale.
      - Undo/redo unifié : l'historique annuler/rétablir couvre maintenant
        aussi bien les traits que les formes dans une seule pile de
        snapshots (`Document = { strokes, shapes }` dans `NotesCanvas.tsx`).
      - *Bug trouvé et corrigé pendant les tests de l'animation* : un
        cercle assez grand et bien rond pouvait être classé à tort comme
        rectangle (tolérance/seuil du test de rectangle trop permissifs à
        grande échelle) — resserré (`tolerance` 12%→8% de la taille,
        seuil d'adhérence aux bords 82%→92%).
      - *Bug plus important trouvé sur appareil réel (iPad + Apple Pencil)* :
        rien ne se redressait jamais, alors que tout fonctionnait dans les
        tests automatisés. Cause : un vrai stylet envoie des `pointermove`
        en continu même à l'arrêt (tremblement de la main, bruit du
        capteur), et le code réinitialisait le minuteur de maintien à
        **chaque** mouvement, aussi minime soit-il — il n'avait donc
        jamais l'occasion d'aller au bout. Invisible avec des événements de
        souris synthétiques (`page.mouse.move` + attente), qui eux
        n'émettent strictement aucun événement pendant l'attente. Corrigé
        par une tolérance de gigue (`HOLD_JITTER_TOLERANCE`, 4px) : le
        minuteur n'est réarmé que si le mouvement dépasse ce rayon autour
        du point d'ancrage. Reproduit et vérifié via de vrais
        `PointerEvent` synthétiques `pointerType: "pen"` envoyés en continu
        avec un micro-bruit aléatoire pendant l'attente (au lieu d'une
        simple pause JS), pour imiter fidèlement un appareil réel.
      - Cette correction a elle-même révélé un troisième bug : les points
        de gigue accumulés *pendant* le maintien (parfois des dizaines,
        concentrés au même endroit) faussaient l'analyse de forme une fois
        le minuteur déclenché. Corrigé en figeant un instantané des points
        du tracé au moment où le minuteur est (ré)armé, et en analysant cet
        instantané plutôt que la liste de points toujours croissante.
      - **Indicateur de debug temporaire** : ajouter `?debug=1` à l'URL
        (`/notes?debug=1`) affiche un encart en direct (type de pointeur,
        outil actif, temps d'immobilité écoulé, écart par rapport à
        l'ancrage, dernier résultat de détection) — pratique pour
        diagnostiquer sur un appareil réel où la console n'est pas
        accessible facilement. À retirer une fois le module stabilisé
        (`debugHoldDetection` sur `NotesCanvas`, lu depuis l'URL dans
        `src/app/notes/page.tsx`).
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
  gomme choisi (fonctionne pareil pour les traits et les formes).
- Détection de formes : heuristiques géométriques simples (pas de ML) —
  variation du rayon par rapport au centroïde pour le cercle (faible et
  stricte pour éviter de confondre avec un rectangle), adhérence aux 4
  bords de la boîte englobante pour le rectangle (rectangle testé en
  premier, car son critère est plus spécifique), écart maximal à la corde
  départ→arrivée pour la ligne droite. Le "maintien" est un simple
  debounce : le minuteur de detection se réarme à chaque `pointermove` et
  ne se déclenche que si le stylet reste immobile ~500ms sans être relâché.
