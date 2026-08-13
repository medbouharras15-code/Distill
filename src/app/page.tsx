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
  // Lemon Squeezy redirige vers "/?checkout=success" après un paiement : le
  // panneau qui affiche cette confirmation vit sur /distill (voir ce
  // dossier), donc on relaie le paramètre plutôt que de le perdre.
  if (params.checkout) {
    redirect(`/distill?checkout=${params.checkout}`);
  }

  redirect("/dashboard");
}
