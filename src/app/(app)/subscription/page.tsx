import { redirect } from "next/navigation";
import { SubscriptionForm } from "@/components/SubscriptionForm";
import { getUserAndProfile } from "@/lib/auth";
import { getSubscriptionProvider, getTier, isSubscribed, remainingFreeGenerations } from "@/lib/billing";

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/");
  }

  const params = await searchParams;
  const checkoutStatus = params.checkout === "success" || params.checkout === "cancelled" ? params.checkout : null;

  return (
    <SubscriptionForm
      subscribed={isSubscribed(auth.profile)}
      tier={getTier(auth.profile)}
      provider={getSubscriptionProvider(auth.profile)}
      paddleCustomerId={auth.profile.paddle_customer_id}
      remaining={remainingFreeGenerations(auth.profile)}
      checkoutStatus={checkoutStatus}
    />
  );
}
