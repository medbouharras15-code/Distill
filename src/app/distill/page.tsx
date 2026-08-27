import { redirect } from "next/navigation";
import { AiFullScreen } from "@/components/notes/AiFullScreen";
import { getUserAndProfile } from "@/lib/auth";
import { getSubscriptionProvider } from "@/lib/billing";

/** Deuxième point d'accès à l'IA (résumé/flashcards), en plein écran — voir
 * @/components/notes/AiFullScreen. Le panneau latéral de l'éditeur
 * (/notes) reste le premier point d'accès, inchangé. */
export default async function DistillPage() {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/login");
  }

  return (
    <AiFullScreen
      subscriptionStatus={auth.profile.subscription_status}
      subscriptionTier={auth.profile.subscription_tier}
      subscriptionProvider={getSubscriptionProvider(auth.profile)}
      generationsUsed={auth.profile.generations_used}
    />
  );
}
