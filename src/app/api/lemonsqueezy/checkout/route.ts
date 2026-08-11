import { NextResponse } from "next/server";
import { lemonSqueezyFetch } from "@/lib/lemonsqueezy";
import { getUserAndProfile } from "@/lib/auth";

interface LemonSqueezyCheckout {
  data: {
    attributes: {
      url: string;
    };
  };
}

/** Crée un checkout Lemon Squeezy et renvoie l'URL de la page hébergée où
 * l'utilisateur paie son abonnement (le formulaire de carte est entièrement
 * affiché par Lemon Squeezy, jamais par notre serveur). */
export async function POST(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }
  const { user } = auth;

  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;
  if (!storeId || !variantId) {
    return NextResponse.json(
      { error: "L'abonnement n'est pas configuré sur le serveur." },
      { status: 500 },
    );
  }

  const origin = new URL(request.url).origin;

  try {
    // On transmet l'id utilisateur en "custom data" : Lemon Squeezy nous le
    // renverra dans le webhook `subscription_created`, ce qui nous permet
    // d'identifier l'utilisateur avant même de connaître l'id d'abonnement.
    const checkout = await lemonSqueezyFetch<LemonSqueezyCheckout>("/checkouts", {
      method: "POST",
      body: {
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email: user.email ?? undefined,
              custom: { user_id: user.id },
            },
            product_options: {
              redirect_url: `${origin}/?checkout=success`,
            },
          },
          relationships: {
            store: { data: { type: "stores", id: storeId } },
            variant: { data: { type: "variants", id: variantId } },
          },
        },
      },
    });

    return NextResponse.json({ url: checkout.data.attributes.url });
  } catch (error) {
    console.error("Erreur lors de la création du checkout Lemon Squeezy :", error);
    return NextResponse.json(
      { error: "Impossible de démarrer le paiement pour le moment." },
      { status: 500 },
    );
  }
}
