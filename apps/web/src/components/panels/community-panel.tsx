"use client";

import { useEffect, useState } from "react";
import type { CorrectionReport } from "@magnexis/shared";
import { getApiClient } from "@/lib/api";
import { Button } from "@magnexis/ui";
import { useAppStore } from "@/lib/store";

export function CommunityPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const openPanel = useAppStore((s) => s.openPanel);
  const [reports, setReports] = useState<CorrectionReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getApiClient()
      .listReports()
      .then((res) => setReports(res.reports))
      .catch(() => setError("Could not load community reports."));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Community</h2>
        <p className="text-sm text-[var(--mx-text-muted)]">
          Public correction activity. Personal details and sensitive evidence are
          redacted.
        </p>
      </div>
      <Button onClick={() => openPanel("report")}>Report an issue</Button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <ul className="space-y-2">
        {reports.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-[var(--mx-border)] px-3 py-2 text-sm"
          >
            <div className="font-medium">{r.trackingId}</div>
            <div className="text-[var(--mx-text-muted)]">
              {r.category.replaceAll("_", " ")} · {r.status}
            </div>
            <div className="mt-1 line-clamp-2">{r.description}</div>
          </li>
        ))}
        {reports.length === 0 && !error ? (
          <li className="text-sm text-[var(--mx-text-muted)]">
            No public reports yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
