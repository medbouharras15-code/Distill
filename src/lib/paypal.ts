/**
 * Client minimal pour l'API REST PayPal (Subscriptions).
 * Doc : https://developer.paypal.com/docs/api/subscriptions/v1/
 */

function apiBase() {
  // "sandbox" (par défaut, pour tester) ou "live" (paiements réels).
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

// Jeton mis en cache en mémoire le temps de son utilité (~9h côté PayPal),
// pour éviter une requête d'authentification à chaque appel. Simple mieux-
// être : dans un environnement serverless, ce cache ne survit que le temps
// où l'instance reste "chaude".
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET ne sont pas configurées.");
  }

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Authentification PayPal échouée (${res.status}).`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    // Marge de sécurité de 60s avant l'expiration réelle.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

/** Appelle l'API PayPal avec authentification automatique. Lève une erreur
 * contenant le détail renvoyé par PayPal si la requête échoue. */
export async function paypalFetch<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${apiBase()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : `Erreur PayPal (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
