import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { paddleFetch } from "@/lib/paddleServer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserActiveTeam } from "@/lib/teamBrainData";

/** Annule l'abonnement Paddle Business Team de l'équipe active de
 * l'utilisateur connecté — équivalent de /api/paddle/cancel pour les
 * paliers individuels, avec la même vérification de propriété que
 * /api/paddle/team-checkout-init (seul owner_id peut annuler) et le même
 * choix de couper immédiatement côté Paddle (`effective_from: "immediately"`)
 * pour rester cohérent avec la mise à jour de subscription_status faite ici
 * même, sans attendre le webhook. */
export async function POST() {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const supabase = await createClient();
  const activeTeam = await getUserActiveTeam(supabase, auth.user.id);
  if (!activeTeam) {
    return NextResponse.json({ error: "Aucune équipe trouvée." }, { status: 400 });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("owner_id, paddle_subscription_id")
    .eq("id", activeTeam.teamId)
    .single();
  if (!team || team.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Seul le propriétaire de l'équipe peut gérer l'abonnement." }, { status: 403 });
  }
  if (!team.paddle_subscription_id) {
    return NextResponse.json({ error: "Aucun abonnement Paddle actif à annuler." }, { status: 400 });
  }

  try {
    await paddleFetch(`/subscriptions/${team.paddle_subscription_id}/cancel`, {
      method: "POST",
      body: { effective_from: "immediately" },
    });

    const admin = createAdminClient();
    await admin.from("teams").update({ subscription_status: "canceled" }).eq("id", activeTeam.teamId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erreur lors de l'annulation de l'abonnement Paddle (équipe) :", error);
    return NextResponse.json({ error: "Impossible d'annuler l'abonnement pour le moment." }, { status: 500 });
  }
}
