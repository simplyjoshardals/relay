"use client";

import { useEffect, useState } from "react";

/**
 * A hydration-safe "current time".
 *
 * Returns `null` on the server render *and* on the client's first paint
 * (React reuses the server markup for that first paint), then flips to
 * the real clock in an effect right after mount and refreshes every
 * `intervalMs` so "3m ago" labels keep advancing.
 *
 * Anything that formats a relative-time string (`relativeTime`,
 * `dayLabel` in `lib/style.ts`) must get its `now` from here rather than
 * calling `new Date()` inline during render. A bare `new Date()` in a
 * Client Component runs once during the server's render pass and again
 * during the client's hydration pass — those two instants are always a
 * little apart, which is enough to flip a boundary ("4s ago" -> "5s
 * ago", "just now" -> "5s ago") and produce exactly the "server
 * rendered text didn't match the client" hydration error. Returning
 * `null` until after mount guarantees both passes render identical text;
 * the swap to a live value then happens as an ordinary post-hydration
 * state update, which React is fine with.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
