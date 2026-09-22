import type { ServiceStatus } from "@/types";

export const SERVICE_STATUSES: ServiceStatus[] = [
  "OPERATIONAL",
  "DEGRADED",
  "OUTAGE",
];

/**
 * Unlike ticket status (server/domain/ticket.ts), service status is never
 * set directly by a human through the catalog form (ServiceModal) — §13
 * is explicit that health numbers are telemetry-driven, either the
 * worker's simulated ticks (Milestone 4) or a real monitoring
 * integration later. So there's no user-facing transition rule to
 * encode here either; this just centralizes the three valid values so
 * validation/repositories/worker all reference one list, same reasoning
 * as the ticket domain module.
 */

/**
 * SM-04: "the dashboard must clearly communicate degraded or unavailable
 * services" — centralizing the OPERATIONAL/DEGRADED/OUTAGE ordering here
 * (rather than each call site re-deriving it) is what lets the worker
 * decide whether a telemetry delta crossed a status boundary worth an
 * Activity row (SM-05) without duplicating the thresholds.
 */
export interface TelemetryThresholds {
  /** latencyMs at or above this, with no error-rate override below, is
   *  DEGRADED. */
  degradedLatencyMs: number;
  /** latencyMs at or above this is OUTAGE regardless of error rate. */
  outageLatencyMs: number;
  /** errorRate (percent) at or above this is DEGRADED. */
  degradedErrorRate: number;
  /** errorRate (percent) at or above this is OUTAGE. */
  outageErrorRate: number;
}

export const DEFAULT_TELEMETRY_THRESHOLDS: TelemetryThresholds = {
  degradedLatencyMs: 250,
  outageLatencyMs: 800,
  degradedErrorRate: 2,
  outageErrorRate: 8,
};

/** Pure function: given a latency/error-rate reading, what status does it
 *  imply? Kept independent of *how* latency/errorRate were produced, so
 *  the same rule works for the simulated worker (Milestone 4) and a real
 *  monitoring integration later — only the input numbers change. */
export function statusForTelemetry(
  latencyMs: number,
  errorRate: number,
  thresholds: TelemetryThresholds = DEFAULT_TELEMETRY_THRESHOLDS,
): ServiceStatus {
  if (
    latencyMs >= thresholds.outageLatencyMs ||
    errorRate >= thresholds.outageErrorRate
  ) {
    return "OUTAGE";
  }
  if (
    latencyMs >= thresholds.degradedLatencyMs ||
    errorRate >= thresholds.degradedErrorRate
  ) {
    return "DEGRADED";
  }
  return "OPERATIONAL";
}
