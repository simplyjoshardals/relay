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
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
