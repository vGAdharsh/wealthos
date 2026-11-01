"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
  }

  if (!isSupabaseConfigured())
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <Card>
          <h1 className="text-xl font-bold">Setup mode</h1>
          <p className="mt-2 text-sm text-muted">
            Accounts activate once Supabase is configured (see{" "}
            <code>.env.example</code>). Meanwhile the app runs in local mode
            with browser storage.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-accent hover:underline">
              Continue in local mode
            </Link>
          </div>
        </Card>
      </main>
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <h1 className="text-xl font-bold">Create your WealthOS account</h1>
        {done ? (
          <p className="mt-4 text-sm text-muted">
            Check your inbox — if email confirmation is enabled, confirm your
            address and then{" "}
            <Link href="/signin" className="font-medium text-accent hover:underline">
              sign in
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password (min 8 characters)</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Creating…" : "Create account"}
            </Button>
          </form>
        )}
        <div className="mt-4 text-sm">
          <Link href="/signin" className="font-medium text-muted hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </Card>
    </main>
  );
}
