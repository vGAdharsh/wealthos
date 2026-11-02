/* eslint-disable react-hooks/set-state-in-effect -- legacy local-mode hydration reads; replaced by server data in Phase 2 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ThemeToggle } from "./theme";

type NavItem = { href: string; label: string; phase?: string };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Money",
    items: [
      { href: "/dashboard", label: "Overview" },
      { href: "/transactions", label: "Transactions" },
      { href: "/income", label: "Income" },
      { href: "/expenses", label: "Expenses" },
      { href: "/budgets", label: "Budgets" },
      { href: "/savings", label: "Savings" },
    ],
  },
  {
    section: "Wealth",
    items: [
      { href: "/investments", label: "Investments" },
      { href: "/assets", label: "Assets" },
      { href: "/networth", label: "Net Worth" },
      { href: "/liabilities", label: "Liabilities & Debt" },
      { href: "/goals", label: "Financial Goals" },
      { href: "/calendar", label: "Financial Calendar" },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/reports", label: "Reports & Analytics" },
      { href: "/ai", label: "AI Assistant" },
      { href: "/import", label: "Import / Export" },
      { href: "/knowledge", label: "Knowledge Centre", phase: "P6" },
    ],
  },
  {
    section: "You",
    items: [{ href: "/settings", label: "Settings & Profile" }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-4">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Wealth<span className="text-accent">OS</span>
        </Link>
        {!isSupabaseConfigured() && (
          <p className="mt-2 rounded-lg bg-warningsoft px-2.5 py-1.5 text-xs text-warning">
            Setup mode — connect Supabase in <b>.env.local</b> to enable sync,
            auth and multi-device data.
          </p>
        )}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {group.section}
            </p>
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accentsoft text-accent"
                      : "text-fg hover:bg-surface2"
                  }`}
                >
                  {item.label}
                  {item.phase ? (
                    <span className="text-[10px] font-semibold text-muted">
                      {item.phase}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{email ?? "Not signed in"}</span>
          <button
            onClick={signOut}
            className="text-xs font-semibold text-muted hover:text-fg"
          >
            Sign out
          </button>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
          <Link href="/dashboard" className="text-base font-bold">
            Wealth<span className="text-accent">OS</span>
          </Link>
          <button
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium"
          >
            Menu
          </button>
        </header>

        {open && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <aside className="absolute top-0 left-0 h-full w-72 border-r border-border bg-surface">
              {sidebar}
            </aside>
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
