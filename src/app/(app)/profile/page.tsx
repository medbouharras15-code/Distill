import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getUserAndProfile } from "@/lib/auth";
import { isSubscribed } from "@/lib/billing";

export default async function ProfilePage() {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/");
  }

  const memberSince = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(auth.profile.created_at),
  );

  return (
    <ProfileForm
      email={auth.user.email ?? ""}
      subscribed={isSubscribed(auth.profile)}
      memberSince={memberSince}
    />
  );
}
