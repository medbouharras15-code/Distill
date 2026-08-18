import { upload } from "@vercel/blob/client";

// Utilitaires client partagés par tout ce qui envoie du texte/photo/PDF à
// l'IA Distill (panneau principal, Mode Explication…) — extraits dans leur
// propre module pour éviter toute dépendance circulaire entre composants
// qui en ont chacun besoin (ex. AiPanel.tsx et ChatView.tsx).

// Les photos sont redimensionnées et recompressées côté client : une photo
// d'iPad de plusieurs Mo devient une poignée de centaines de Ko avant envoi,
// ce qui évite à la fois de dépasser la taille de requête autorisée et de
// ralentir inutilement l'analyse par Claude.
const MAX_IMAGE_DIMENSION = 1568;
const IMAGE_JPEG_QUALITY = 0.85;

/** Redimensionne et recompresse une image (JPEG) via un canvas, quel que
 * soit son format d'origine. Réduit fortement le poids des photos avant
 * l'envoi au serveur. */
export function resizeImageToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { naturalWidth: width, naturalHeight: height } = img;
      if (!width || !height) {
        reject(new Error("Cette image n'a pas pu être lue. Essayez un autre fichier."));
        return;
      }
      if (Math.max(width, height) > MAX_IMAGE_DIMENSION) {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Cet appareil ne permet pas de traiter l'image."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Cette image n'a pas pu être compressée."));
        return;
      }
      resolve(base64);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Cette image n'a pas pu être ouverte. Essayez un format JPG ou PNG."));
    };

    img.src = objectUrl;
  });
}

/** Téléverse le PDF directement du navigateur vers Vercel Blob (jeton émis
 * par @/app/api/upload/pdf) — il ne transite jamais par le corps de la
 * requête vers /api/distill, /api/distill/quiz ou /api/distill/chat, ce qui
 * permet des PDF bien plus lourds que la limite de 4,5 Mo des Functions
 * Vercel. Chaque appel téléverse sa propre copie : le serveur supprime la
 * sienne juste après usage, donc rien n'est partagé ni réutilisé entre
 * appels. */
export async function uploadPdfToBlob(file: File): Promise<{ url: string; mediaType: "application/pdf" }> {
  const blob = await upload(file.name, file, {
    access: "private",
    handleUploadUrl: "/api/upload/pdf",
  });
  return { url: blob.url, mediaType: "application/pdf" };
}
