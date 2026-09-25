import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Every route under app/(dashboard) is dynamically rendered (`ƒ`,
    // not `○`) — inherent to real per-user auth, not a bug: the layout's
    // `getCurrentUser()` (server/auth/session.ts) reads the session
    // cookie via `cookies()`, and any segment that touches a
    // request-time API like that can't be statically prerendered. That
    // part isn't something to "fix" here without a much bigger
    // restructure (Partial Prerendering / Cache Components, splitting
    // the auth check into its own Suspense-wrapped slice) — out of
    // scope for this.
    //
    // What *is* fixable at this layer: Next's Client Router Cache
    // treats every dynamic route's RSC payload as stale the instant
    // it's fetched (`staleTimes.dynamic` defaults to 0s), so a client-
    // side navigation away from /dashboard and back — Link, back
    // button, router.push, no full reload — re-requests the whole page
    // from the server every time: the layout re-runs, `getCurrentUser()`
    // re-resolves the session, and `dashboard/page.tsx`'s 5
    // `prefetchQuery` calls re-fetch from the DB, all before any of the
    // STREAMING_SSR_TODO.md/QueryProvider work downstream even gets a
    // say. That's the "no longer static" refetch-on-every-visit this
    // was reported as — a different layer from QueryProvider's
    // `staleTime` (which only governs whether the *browser* re-fetches
    // once it already has the RSC-hydrated data; it can't stop the RSC
    // request itself from happening).
    //
    // 24 hours, not a literal "forever" — Next doesn't offer an
    // Infinity/off setting for this, just a number of seconds, and an
    // arbitrarily huge magic number (some projects use 4294967294) buys
    // nothing real over a value already longer than any session:
    // this cache is in-memory per tab and is gone on the next hard
    // reload or new tab regardless of what it's set to.
    //
    // A long value is safe specifically *because* of how this app is
    // built, not despite it:
    //   - RealtimeProvider lives in the shared (dashboard) layout, so
    //     it keeps invalidating queries (per-broadcast, plus everything
    //     on reconnect, §35) the whole time you're in the app, no
    //     matter which page is on screen or how old this cache thinks
    //     that page's render is.
    //   - TanStack's own `hydrate()` only overwrites a query if the
    //     incoming snapshot is newer than what's already live in the
    //     browser's QueryClient — replaying an old cached RSC render
    //     here can't push already-fresher realtime data backwards.
    //   - Per Next's docs, shared layouts (where the session check —
    //     `getCurrentUser()` — actually lives) are never re-fetched on
    //     soft navigation regardless of this setting; that's a
    //     separate, always-on behavior, not something this value
    //     changes or newly relies on.
    //   - Any hard reload or fresh tab bypasses this cache completely
    //     and re-validates the session from scratch, same as today.
    // So the actual freshness guarantee is coming from the socket, not
    // from keeping this number small — a long value here just stops
    // Next from redundantly re-running the page's own `prefetchQuery`
    // calls when nothing real has changed.
    staleTimes: {
      dynamic: 60 * 60 * 24,
    },
  },
};

export default nextConfig;
