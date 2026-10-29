"use client";

import { useAppStore } from "@/lib/store";
import { trafficConfigured } from "@/lib/traffic";

const STOPS: { label: string; color: string }[] = [
  { label: "Clear", color: "#c9b896" },
  { label: "Slow", color: "#e0b85c" },
  { label: "Heavy", color: "#d9924a" },
  { label: "Jam", color: "#b86a6a" },
];

/**
 * Google Maps–style congestion key — only when live traffic tiles are on.
 */
export function TrafficLegend() {
  const trafficOn = useAppStore((s) => s.layers.traffic);
  if (!trafficConfigured() || !trafficOn) return null;

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: "max(0.75rem, var(--mx-safe-l))",
        bottom: "var(--mx-fab-stack)",
      }}
      role="status"
      aria-label="Traffic congestion legend"
    >
      <div className="rounded-xl border border-[var(--mx-border)] bg-[var(--mx-surface)]/95 px-2.5 py-2 shadow-[var(--mx-shadow-soft)] backdrop-blur-sm">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-text-muted)]">
          Traffic
        </p>
        <ul className="flex flex-col gap-1">
          {STOPS.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-2 text-[11px] text-[var(--mx-text)]"
            >
              <span
                className="h-1.5 w-5 shrink-0 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
