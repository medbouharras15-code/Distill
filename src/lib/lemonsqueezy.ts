/**
 * Client minimal pour l'API REST Lemon Squeezy.
 * Doc : https://docs.lemonsqueezy.com/api
 */

const API_BASE = "https://api.lemonsqueezy.com/v1";

/** Appelle l'API Lemon Squeezy avec authentification par clé API. Lève une
 * erreur contenant le détail renvoyé par Lemon Squeezy si la requête échoue. */
export async function lemonSqueezyFetch<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY n'est pas configurée.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message =
      typeof data === "object" && data && "errors" in data
        ? JSON.stringify((data as { errors: unknown }).errors)
        : `Erreur Lemon Squeezy (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
