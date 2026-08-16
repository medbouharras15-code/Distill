// Vercel plafonne le corps d'une requête de Function à 4,5 Mo — une limite
// d'infrastructure fixe, non modifiable via vercel.json ni le code
// (https://vercel.com/docs/functions/limitations). Le PDF est transmis en
// base64 dans le JSON, ce qui gonfle sa taille de ~33 % (base64 = brut ×
// 4/3) : c'est ça, et non le traitement IA ou un risque de timeout, qui
// borne le maximum réellement atteignable. Calcul (marge conservatrice,
// 4,5 Mo pris en interprétation décimale) :
//   4 500 000 (plafond Vercel)
//   -  150 000 (réservés au texte collé + à la structure JSON)
//   = 4 350 000 octets disponibles pour le PDF encodé en base64
//   × 3/4 (retour à la taille brute) ≈ 3,11 Mo
// D'où 3,1 Mo retenu ci-dessous : c'est très proche du plafond réel, pas
// une marge arbitrairement prudente. Pour aller nettement plus loin (PDF
// de cours de 10-20 Mo), il faudrait changer d'architecture : upload direct
// du navigateur vers un stockage (Vercel Blob) qui contourne entièrement
// cette limite de corps de requête, la route ne recevant plus qu'une
// référence au fichier — hors périmètre de cette augmentation ponctuelle.
//
// Fichier volontairement sans dépendance serveur (pas de SDK Anthropic, pas
// de next/server) : importé tel quel par le client (AiPanel.tsx, pour
// valider avant l'envoi) et par le serveur (distillServer.ts).
export const MAX_PDF_FILE_BYTES = 3.1 * 1024 * 1024; // ~3,1 Mo par PDF, brut

// Les images sont compressées côté client avant envoi (voir AiPanel.tsx) et
// ne s'approchent jamais de cette taille en usage normal : plafond
// nettement plus généreux qu'il n'est nécessaire, gardé comme simple
// garde-fou défensif plutôt que recalculé au plus juste comme le PDF.
export const MAX_IMAGE_FILE_BYTES = 4 * 1024 * 1024; // 4 Mo une fois décodée/compressée
