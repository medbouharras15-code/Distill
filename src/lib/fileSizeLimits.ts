// Fichier volontairement sans dépendance serveur (pas de SDK Anthropic, pas
// de next/server) : importé tel quel par le client (AiPanel.tsx, pour
// valider avant l'envoi) et par le serveur (distillServer.ts, pour
// revalider).

// Les PDF sont téléversés directement du navigateur vers Vercel Blob (voir
// @/app/api/upload/pdf), donc plus jamais transmis dans le corps de la
// requête vers /api/distill — la limite n'est donc plus bornée par le
// plafond de 4,5 Mo des Functions Vercel, mais choisie pour rester
// raisonnable : un cours de plusieurs dizaines de Mo ferait grimper le
// temps d'analyse par Claude et le coût par génération sans réel bénéfice
// pédagogique. 15 Mo couvre largement un support de cours (texte + quelques
// images/schémas), avec la marge de temps déjà prise sur /api/distill et
// /api/distill/quiz (maxDuration = 300 s).
export const MAX_PDF_FILE_BYTES = 15 * 1024 * 1024; // 15 Mo par PDF, brut

// Les images, elles, restent transmises inline (base64 dans le corps de la
// requête) : compressées côté client avant envoi (voir AiPanel.tsx), elles
// ne s'approchent jamais de cette taille en usage normal. Ce plafond reste
// borné par la limite réelle de 4,5 Mo de Vercel (base64 gonfle de ~33 %),
// gardé nettement plus généreux qu'il n'est nécessaire, comme simple
// garde-fou défensif.
export const MAX_IMAGE_FILE_BYTES = 4 * 1024 * 1024; // 4 Mo une fois décodée/compressée
