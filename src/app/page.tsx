import LandingGate from "@/components/LandingGate";
import { getUserAndProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const auth = await getUserAndProfile();

  if (!auth) {
    return <LandingGate />;
  }

  const params = await searchParams;
  // Lemon Squeezy redirige vers "/?checkout=success" après un paiement : la
  // confirmation s'affiche désormais dans le panneau IA de l'éditeur (voir
  // @/components/notes/AiPanel), donc on relaie le paramètre vers /notes
  // plutôt que de le perdre.
  if (params.checkout) {
    redirect(`/notes?checkout=${params.checkout}`);
  }

  redirect("/dashboard");
}
