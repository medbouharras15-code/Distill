import DistillApp from "@/components/DistillApp";
import { getUserAndProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Ancien écran principal ("coller texte/photo/PDF → résumé/flashcards"),
 * déplacé ici depuis "/" le temps que son comportement soit repris à
 * l'identique dans le panneau IA du nouvel éditeur de notes (@/app/notes) —
 * voir la refonte de navigation démarrée en Phase 3. Comportement inchangé :
 * seul l'emplacement de la route change. À supprimer une fois ce panneau IA
 * livré. */
export default async function DistillPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const auth = await getUserAndProfile();
  const params = await searchParams;

  if (!auth) {
    redirect("/");
  }

  const checkoutStatus =
    params.checkout === "success" || params.checkout === "cancelled"
      ? params.checkout
      : null;

  return (
    <main className="flex flex-1 flex-col bg-background">
      <DistillApp
        email={auth.user.email ?? ""}
        subscriptionStatus={auth.profile.subscription_status}
        generationsUsed={auth.profile.generations_used}
        checkoutStatus={checkoutStatus}
      />
    </main>
  );
}
