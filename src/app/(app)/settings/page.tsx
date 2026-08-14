import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";
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

  return (
    <SettingsForm
      email={auth.user.email ?? ""}
      subscribed={isSubscribed(auth.profile)}
      memberSince={memberSince}
    />
  );
}
