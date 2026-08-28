/**
 * Client minimal pour l'API REST Paddle Billing — équivalent server-only de
 * @/lib/lemonsqueezy pour Paddle. Doc : https://developer.paddle.com/api-reference
 *
 * Contrairement à @/lib/paddle.ts (client + serveur, rien de sensible), ce
 * fichier ne doit être importé que depuis du code serveur : PADDLE_API_KEY
 * est un vrai secret.
 */
import { PADDLE_API_BASE } from "@/lib/paddle";

/** Appelle l'API Paddle avec authentification par clé API. Lève une erreur
 * contenant le détail renvoyé par Paddle si la requête échoue. */
export async function paddleFetch<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  // .trim() défensif : même classe de bug que NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  // (voir @/lib/paddle) — un copier-coller depuis le dashboard Paddle vers
  // Vercel peut laisser un retour à la ligne en fin de valeur, ce qui rend
  // l'en-tête Authorization invalide ("authentication_malformed" côté
  // Paddle) sans que la clé elle-même soit fausse.
  const apiKey = (process.env.PADDLE_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY n'est pas configurée.");
  }

  const res = await fetch(`${PADDLE_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : `Erreur Paddle (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
