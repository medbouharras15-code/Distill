import { redirect } from "next/navigation";
import { TeamBrain } from "@/components/team-brain/TeamBrain";
import { getUserAndProfile } from "@/lib/auth";

/** Démo Team Brain — design uniquement (voir @/components/team-brain),
 * aucune logique de paiement/permissions réelle. Même garde d'authentification
 * que le reste des pages de l'espace connecté. */
export default async function TeamBrainPage() {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/");
  }

  return <TeamBrain />;
}
