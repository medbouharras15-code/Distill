import NotesPageClient from "@/components/notes/NotesPageClient";
import { getUserAndProfile } from "@/lib/auth";

/** Le canvas de dessin reste accessible sans connexion (comme avant) ; le
 * panneau IA (résumé/flashcards), lui, nécessite un compte — voir
 * NotesPageClient, qui reçoit `auth: null` pour un visiteur non connecté et
 * redirige vers /login au clic sur le bouton IA de la barre d'outils. */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; ai?: string }>;
}) {
  const auth = await getUserAndProfile();
  const params = await searchParams;

  const checkoutStatus =
    params.checkout === "success" || params.checkout === "cancelled" ? params.checkout : null;

  return (
    <NotesPageClient
      auth={
        auth
          ? {
              subscriptionStatus: auth.profile.subscription_status,
              subscriptionTier: auth.profile.subscription_tier,
              generationsUsed: auth.profile.generations_used,
            }
          : null
      }
      checkoutStatus={checkoutStatus}
      openAi={params.ai === "1"}
    />
  );
}
