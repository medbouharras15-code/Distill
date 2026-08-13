import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getUserAndProfile } from "@/lib/auth";
import { isSubscribed } from "@/lib/billing";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/");
  }

  return (
    <AppShell email={auth.user.email ?? ""} subscribed={isSubscribed(auth.profile)}>
      {children}
    </AppShell>
  );
}
