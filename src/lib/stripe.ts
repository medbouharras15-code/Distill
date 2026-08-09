import Stripe from "stripe";

/** Client Stripe côté serveur uniquement (utilise la clé secrète). */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY n'est pas configurée sur le serveur.");
  }
  return new Stripe(key);
}
