import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";
import { getMonthlyUsageSummaryJetons } from "@/lib/aiUsage";
import { getUserAndProfile } from "@/lib/auth";
import { isSubscribed } from "@/lib/billing";

export default async function SettingsPage() {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/");
  }

  const memberSince = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(auth.profile.created_at),
  );
  const subscribed = isSubscribed(auth.profile);
  // Le suivi de consommation n'a de sens que pour les abonnés — le quota
  // gratuit se mesure en nombre de générations, pas en jetons (voir
  // @/lib/aiUsage). Évite une requête inutile pour les comptes gratuits.
  // Affiché en jetons uniquement (voir @/lib/jetons) : le calcul en euros
  // reste interne, jamais montré au client.
  const usage = subscribed ? await getMonthlyUsageSummaryJetons(auth.user.id) : null;

  return (
    <SettingsForm
      email={auth.user.email ?? ""}
      subscribed={subscribed}
      memberSince={memberSince}
      usage={usage}
    />
  );
}
