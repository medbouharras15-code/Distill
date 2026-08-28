import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { teamTierForSeats } from "@/lib/paddle";
import { paddleFetch } from "@/lib/paddleServer";
import { createClient } from "@/lib/supabase/server";
import { getUserActiveTeam } from "@/lib/teamBrainData";

const MIN_SEATS = 3;
const MAX_SEATS = 50;

/** Prépare l'ouverture de l'overlay de paiement Paddle pour l'offre Business
 * Team — équivalent de /api/paddle/checkout-init pour les paliers
 * individuels, mais résout l'équipe active de l'utilisateur connecté (une
 * seule équipe par utilisateur, voir getUserActiveTeam) plutôt qu'un palier
 * fixe, et vérifie qu'il en est bien le propriétaire : seul owner_id peut
 * gérer la facturation, un membre/admin ordinaire ne le peut pas. */
export async function POST(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  let body: { seats?: number };
  try {
    body = (await request.json()) as { seats?: number };
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const seats = body.seats;
  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
    return NextResponse.json({ error: `Nombre de sièges invalide (${MIN_SEATS} à ${MAX_SEATS}).` }, { status: 400 });
  }

  const supabase = await createClient();
  const activeTeam = await getUserActiveTeam(supabase, auth.user.id);
  if (!activeTeam) {
    return NextResponse.json({ error: "Créez d'abord votre équipe avant de vous abonner." }, { status: 400 });
  }

  const { data: team } = await supabase.from("teams").select("owner_id").eq("id", activeTeam.teamId).single();
  if (!team || team.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Seul le propriétaire de l'équipe peut gérer l'abonnement." }, { status: 403 });
  }

  const { priceId } = teamTierForSeats(seats);
  if (!priceId) {
    return NextResponse.json({ error: "Ce palier n'est pas encore configuré pour le paiement." }, { status: 500 });
  }

  // Même prévalidation que /api/paddle/checkout-init (voir son historique) :
  // confirme que ce Price ID existe, est actif et appartient au bon
  // compte/environnement avant d'ouvrir l'overlay Paddle.js, dont les échecs
  // de configuration ne remontent pas toujours d'information exploitable.
  try {
    const { data: price } = await paddleFetch<{ data: { status?: string } }>(`/prices/${priceId}`);
    if (price.status !== "active") {
      return NextResponse.json(
        { error: `Paddle a rejeté ce palier : le prix ${priceId} a le statut "${price.status}" (attendu : "active").` },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Paddle a rejeté ce palier : ${err instanceof Error ? err.message : "erreur inconnue"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ teamId: activeTeam.teamId, priceId });
}
