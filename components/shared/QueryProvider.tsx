"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

/**
 * §10: "TanStack Query owns all server-derived state... one
 * QueryClientProvider at the root." "Root" here means the root of the
 * authenticated app (this composes alongside ToastProvider in the
 * dashboard layout) rather than the true app root — /login has nothing
 * to query, so there's no reason to give it a query client too.
 *
 * The QueryClient is created once via useState's lazy initializer, not
 * as a plain `new QueryClient()` inline — that would build a fresh
 * client (and lose all cached data) on every render.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // TanStack's default ("online") *pauses* a mutation while the
          // browser is offline and fires it whenever connectivity comes
          // back — so a Save clicked offline would sit on "Saving…"
          // indefinitely, then land later against a `version` that may
          // have moved on. "always" makes it attempt immediately and
          // fail fast, which puts the failure through onError (rollback
          // + an honest toast) instead of hiding it. Queries keep the
          // default: paused while offline, refetched on reconnect.
          mutations: { networkMode: "always" },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
