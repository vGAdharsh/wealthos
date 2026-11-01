"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email);
    if (error) return setError(error.message);
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <h1 className="text-xl font-bold">Reset your password</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted">
            If an account exists for {email}, a reset link is on its way.
          </p>
        ) : isSupabaseConfigured() ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full">
              Send reset link
            </Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Password reset activates once Supabase is configured (see{" "}
            <code>.env.example</code>).
          </p>
        )}
        <div className="mt-4 text-sm">
          <Link href="/signin" className="font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </Card>
    </main>
  );
}
