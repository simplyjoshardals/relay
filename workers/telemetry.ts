import "dotenv/config";
import { listOrgIdsForTelemetry } from "@/server/application/organizations";
import {
  listActiveServicesForTelemetry,
  updateServiceTelemetry,
} from "@/server/application/services";
import { statusForTelemetry } from "@/server/domain/service";
import type { Service } from "@/types";

/**
 * README §13: a standalone, long-lived Node process — run on its own
 * (`yarn worker:telemetry`, or as a small always-on process alongside
 * the Next.js app in production), never as a serverless function or a
 * cron job, and never reached over HTTP. It imports only from
 * `/server/application` (never `/server/repositories`/`/db` directly) —
 * the one exception is `/server/domain`'s `statusForTelemetry`, a pure
 * function with no database or auth surface of its own, so importing it
 * directly isn't the kind of repository-layer bypass that boundary is
 * guarding against.
 *
 * This uses `@/*` path aliases, unlike prisma/seed.ts's deliberately
 * relative imports — seed.ts avoids the alias because it only needs to
 * reach a couple of files with zero transitive `@/*` imports of their
 * own (see its comment); that workaround doesn't scale to this worker,
 * which by design pulls in all of `/server/application/services.ts` and
 * everything *that* imports. This relies on tsx (already a
 * devDependency) resolving tsconfig's `paths` the same way it does for
 * every other server file — confirm with a real `yarn worker:telemetry`
 * run before treating this as settled, same spirit as the Realtime
 * Authorization check the roadmap calls out before Milestone 3.
 */

// How often the worker ticks. A few seconds feels "live" on the
// dashboard without hammering the database — README §13 wants something
// that ticks "every few seconds," not sub-second precision (§7 already
// tells clients to debounce service.updated for exactly this reason).
const TICK_INTERVAL_MS = Number(process.env.TELEMETRY_TICK_MS ?? 4_000);

// Per-tick random-walk step size, and occasional larger excursions so a
// service actually crosses into DEGRADED/OUTAGE now and then (Test 6)
// rather than drifting forever in a narrow healthy band.
const LATENCY_STEP_MS = 12;
const ERROR_RATE_STEP = 0.35;
const SPIKE_PROBABILITY = 0.06;
const SPIKE_LATENCY_MS = 260;
const SPIKE_ERROR_RATE = 4;

// Recovery pull: nudges a reading back toward a healthy baseline each
// tick, proportional to how far above baseline it currently is. Without
// this, the random walk has no restoring force and every service
// eventually wanders into OUTAGE and stays there — a "plausible
// telemetry producer" (§36) should mostly hover healthy with occasional
// excursions, not monotonically degrade.
const RECOVERY_FRACTION = 0.15;
const BASELINE_LATENCY_MS = 110;
const BASELINE_ERROR_RATE = 0.3;

const MIN_LATENCY_MS = 20;
const MAX_LATENCY_MS = 2_000;
const MIN_ERROR_RATE = 0;
const MAX_ERROR_RATE = 25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Next latency/error-rate reading for one service: pull toward
 *  baseline, add ordinary jitter, and occasionally throw in a spike —
 *  "a plausible latency/error-rate delta," per §13's own wording, rather
 *  than each tick being fully independent of the last. */
function nextReading(service: Service): {
  latencyMs: number;
  errorRate: number;
} {
  const latencyPull =
    (BASELINE_LATENCY_MS - service.latencyMs) * RECOVERY_FRACTION;
  const errorPull =
    (BASELINE_ERROR_RATE - service.errorRate) * RECOVERY_FRACTION;

  const spiking = Math.random() < SPIKE_PROBABILITY;

  const latencyDelta =
    latencyPull +
    randomBetween(-LATENCY_STEP_MS, LATENCY_STEP_MS) +
    (spiking ? randomBetween(0, SPIKE_LATENCY_MS) : 0);

  const errorDelta =
    errorPull +
    randomBetween(-ERROR_RATE_STEP, ERROR_RATE_STEP) +
    (spiking ? randomBetween(0, SPIKE_ERROR_RATE) : 0);

  return {
    latencyMs: Math.round(
      clamp(service.latencyMs + latencyDelta, MIN_LATENCY_MS, MAX_LATENCY_MS),
    ),
    errorRate:
      Math.round(
        clamp(service.errorRate + errorDelta, MIN_ERROR_RATE, MAX_ERROR_RATE) *
          100,
      ) / 100,
  };
}

async function tickService(orgId: string, service: Service): Promise<void> {
  const { latencyMs, errorRate } = nextReading(service);
  const status = statusForTelemetry(latencyMs, errorRate);

  try {
    await updateServiceTelemetry(orgId, service.id, {
      latencyMs,
      errorRate,
      status,
    });
  } catch (error) {
    // One service's write failing (a transient DB hiccup) shouldn't stop
    // the rest of this tick, or the loop overall — there's another tick
    // in a few seconds regardless (same "degraded, not fatal" posture
    // as broadcastToOrg's own error handling).
    console.error(
      `telemetry worker: failed to update service ${service.id} in org ${orgId}`,
      error,
    );
  }
}

async function tickOrg(orgId: string): Promise<void> {
  const services = await listActiveServicesForTelemetry(orgId);
  await Promise.all(services.map((service) => tickService(orgId, service)));
}

async function tick(): Promise<void> {
  const orgIds = await listOrgIdsForTelemetry();
  await Promise.all(orgIds.map((orgId) => tickOrg(orgId)));
}

async function main() {
  console.log(
    `telemetry worker: starting, ticking every ${TICK_INTERVAL_MS}ms`,
  );

  // Run once immediately rather than waiting a full interval for the
  // first tick — otherwise a freshly started worker leaves the
  // dashboard showing stale/zeroed numbers for the first several
  // seconds.
  await tick().catch((error) =>
    console.error("telemetry worker: tick failed", error),
  );

  const timer = setInterval(() => {
    void tick().catch((error) =>
      console.error("telemetry worker: tick failed", error),
    );
  }, TICK_INTERVAL_MS);

  const shutdown = (signal: string) => {
    console.log(`telemetry worker: received ${signal}, shutting down`);
    clearInterval(timer);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main();
