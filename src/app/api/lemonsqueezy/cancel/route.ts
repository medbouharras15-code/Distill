import { NextResponse } from "next/server";
import { lemonSqueezyFetch } from "@/lib/lemonsqueezy";
import { getUserAndProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Annule l'abonnement Lemon Squeezy de l'utilisateur connecté. L'accès
 * illimité s'arrête immédiatement (pas de période de grâce, pour rester
 * simple). */
export async function POST() {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }
  const { user, profile } = auth;

  if (!profile.lemonsqueezy_subscription_id) {
    return NextResponse.json(
      { error: "Aucun abonnement actif à annuler." },
      { status: 400 },
    );
  }

  try {
    await lemonSqueezyFetch(`/subscriptions/${profile.lemonsqueezy_subscription_id}`, {
      method: "DELETE",
    });

    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ subscription_status: "cancelled" })
      .eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erreur lors de l'annulation de l'abonnement Lemon Squeezy :", error);
    return NextResponse.json(
      { error: "Impossible d'annuler l'abonnement pour le moment." },
      { status: 500 },
    );
  }
}
