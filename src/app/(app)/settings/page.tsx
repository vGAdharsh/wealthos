"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    createClient().auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function signOut() {
    if (isSupabaseConfigured()) await createClient().auth.signOut();
    router.push("/signin");
  }

  return (
    <div>
      <PageHeader
        title="Settings & Profile"
        subtitle="Account, appearance and data preferences."
      />
      <div className="max-w-xl space-y-6">
        <Card>
          <h2 className="text-base font-semibold">Account</h2>
          {isSupabaseConfigured() ? (
            <p className="mt-2 text-sm text-muted">
              Signed in as <span className="font-medium text-fg">{email ?? "…"}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Running in local mode. Create a free Supabase project and set{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
              <code>.env.local</code> to enable accounts and database sync.
            </p>
          )}
          {isSupabaseConfigured() && (
            <div className="mt-4">
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Appearance</h2>
          <p className="mt-2 text-sm text-muted">
            Light, dark, or follow your system preference.
          </p>
          <div className="mt-3">
            <ThemeToggle />
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">
            Profile & preferences <Badge tone="info">Phase 2</Badge>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Full name, currency, timezone and notification preferences sync to
            your database profile in Phase 2.
          </p>
        </Card>
      </div>
    </div>
  );
}
