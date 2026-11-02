import { redirect } from "next/navigation";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { DataProviderProvider } from "@/lib/repository/provider";

/**
 * Protected application group. When Supabase is configured, unauthenticated
 * visitors are sent to sign-in; in setup mode the shell renders so the app
 * remains usable locally (data stays in the browser until migrated).
 */
export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/signin");
  }
  return (
    <DataProviderProvider>
      <AppShell>{children}</AppShell>
    </DataProviderProvider>
  );
}
