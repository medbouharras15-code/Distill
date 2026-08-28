import { redirect } from "next/navigation";
import { TeamSubscriptionForm } from "@/components/TeamSubscriptionForm";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUserActiveTeam } from "@/lib/teamBrainData";
import type { Team } from "@/lib/types";

/** Offre Team Brain (par siège), maintenant réellement payante via Paddle
 * (voir TeamSubscriptionForm) — résout l'équipe active de l'utilisateur
 * connecté (une seule équipe par utilisateur, voir getUserActiveTeam) pour
 * savoir si un abonnement existe déjà et s'il en est le propriétaire, seul
 * habilité à gérer la facturation. `team` reste `null` tant qu'aucune
 * équipe n'existe : la page renvoie alors vers /team-brain pour en créer
 * une d'abord (aucune création d'équipe sur cette page). */
export default async function SubscriptionTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/");
  }

  const params = await searchParams;
  const checkoutStatus = params.checkout === "success" || params.checkout === "cancelled" ? params.checkout : null;

  const supabase = await createClient();
  const activeTeam = await getUserActiveTeam(supabase, auth.user.id);

  let team: Team | null = null;
  if (activeTeam) {
    const { data } = await supabase.from("teams").select("*").eq("id", activeTeam.teamId).single();
    team = (data as Team | null) ?? null;
  }

  return (
    <TeamSubscriptionForm
      team={team}
      isOwner={team ? team.owner_id === auth.user.id : false}
      paddleCustomerId={auth.profile.paddle_customer_id}
      checkoutStatus={checkoutStatus}
    />
  );
}
