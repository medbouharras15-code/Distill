import { TeamSubscriptionForm } from "@/components/TeamSubscriptionForm";

/** Offre Team Brain (par siège) — page purement informative, aucune donnée
 * propre à l'utilisateur nécessaire. L'authentification est déjà garantie
 * par le layout du groupe (app) (redirect si non connecté), pas besoin de
 * la revérifier ici. */
export default function SubscriptionTeamPage() {
  return <TeamSubscriptionForm />;
}
