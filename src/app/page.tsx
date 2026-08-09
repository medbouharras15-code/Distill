import DistillApp from "@/components/DistillApp";
import LandingGate from "@/components/LandingGate";
import { getUserAndProfile } from "@/lib/auth";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const auth = await getUserAndProfile();
  const params = await searchParams;

  if (!auth) {
    return <LandingGate />;
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
