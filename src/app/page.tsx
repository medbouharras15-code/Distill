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
  // confirmation s'affiche sur la page Abonnement dédiée (voir
  // @/app/(app)/subscription), donc on relaie le paramètre plutôt que de le
  // perdre.
  if (params.checkout) {
    redirect(`/subscription?checkout=${params.checkout}`);
  }

  redirect("/dashboard");
}
