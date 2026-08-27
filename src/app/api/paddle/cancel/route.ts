import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { paddleFetch } from "@/lib/paddleServer";
import { createAdminClient } from "@/lib/supabase/admin";

/** Annule l'abonnement Paddle de l'utilisateur connecté — équivalent Paddle
 * de /api/lemonsqueezy/cancel. `effective_from: "immediately"` pour rester
 * cohérent avec le comportement Lemon Squeezy existant : l'accès s'arrête
 * tout de suite côté Distill (mise à jour de subscription_status ici même,
 * sans attendre le webhook), donc l'abonnement doit aussi être coupé
 * immédiatement côté Paddle plutôt qu'à la fin de la période de
 * facturation (comportement par défaut de Paddle) — sinon Paddle
 * continuerait de le considérer actif jusqu'à la prochaine échéance,
 * désynchronisé de notre propre statut. */
export async function POST() {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }
  const { user, profile } = auth;

  if (!profile.paddle_subscription_id) {
    return NextResponse.json({ error: "Aucun abonnement Paddle actif à annuler." }, { status: 400 });
  }

  try {
    await paddleFetch(`/subscriptions/${profile.paddle_subscription_id}/cancel`, {
      method: "POST",
      body: { effective_from: "immediately" },
    });

    const admin = createAdminClient();
    await admin.from("profiles").update({ subscription_status: "canceled" }).eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erreur lors de l'annulation de l'abonnement Paddle :", error);
    return NextResponse.json({ error: "Impossible d'annuler l'abonnement pour le moment." }, { status: 500 });
  }
}
