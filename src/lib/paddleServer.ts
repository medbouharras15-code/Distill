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
  const apiKey = process.env.PADDLE_API_KEY;
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
