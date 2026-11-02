"use client";

import { createContext, useContext, useMemo } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { LocalProvider } from "./local-repo";
import { SupabaseProvider } from "./supabase-repo";
import type { DataProvider } from "./types";

const ProviderContext = createContext<DataProvider | null>(null);

/**
 * Picks the active provider once per session: database mode when
 * Supabase credentials exist, local mode otherwise. Pages never know
 * which one is active.
 */
export function DataProviderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const provider = useMemo<DataProvider>(
    () => (isSupabaseConfigured() ? new SupabaseProvider() : new LocalProvider()),
    [],
  );
  return (
    <ProviderContext.Provider value={provider}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useRepository(): DataProvider {
  const ctx = useContext(ProviderContext);
  if (!ctx)
    throw new Error("useRepository must be used inside DataProviderProvider");
  return ctx;
}
