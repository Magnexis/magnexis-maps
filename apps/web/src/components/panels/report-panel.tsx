"use client";

import { useState } from "react";
import { Button, Input } from "@magnexis/ui";
import { ISSUE_CATEGORIES, type IssueCategory } from "@magnexis/shared";
import { MagnexisApiError } from "@magnexis/api-client";
import { getApiClient } from "@/lib/api";
import { useAppStore } from "@/lib/store";

const LABELS: Record<IssueCategory, string> = {
  incorrect_address: "Incorrect address",
  incorrect_business_name: "Incorrect business name",
  incorrect_business_hours: "Incorrect business hours",
  permanently_closed: "Permanently closed business",
  missing_business: "Missing business",
  incorrect_road_name: "Incorrect road name",
  road_closure: "Road closure",
  missing_road: "Missing road",
  incorrect_one_way: "Incorrect one-way direction",
  missing_building: "Missing building",
  incorrect_marker: "Incorrect map marker",
  missing_landmark: "Missing landmark",
  incorrect_boundary: "Incorrect geographic boundary",
  accessibility: "Accessibility information",
  other: "Other geographic issue",
};

export function ReportPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const {
    reportDraft,
    setReportDraft,
    mapView,
    selectedPlace,
    setLastReport,
    lastReport,
  } = useAppStore();
  const [guestEmail, setGuestEmail] = useState("");
  const [proposedName, setProposedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"edit" | "review" | "done">("edit");

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("magnexis_token")
          : null;
      if (!token && !guestEmail) {
        setError("Sign in, or provide a guest email for rate-limited reporting.");
        setLoading(false);
        return;
      }

      const { report } = await getApiClient().createReport({
        category: reportDraft.category as IssueCategory,
        description: reportDraft.description,
        coordinates: selectedPlace?.coordinates ?? mapView.center,
        placeId: selectedPlace?.id,
        proposedChanges: proposedName
          ? { name: proposedName }
          : undefined,
        guestEmail: token ? undefined : guestEmail || undefined,
      });
      setLastReport(report);
      setStep("done");
    } catch (err) {
      setError(
        err instanceof MagnexisApiError
          ? err.message
          : "Could not submit report. Is the API running?",
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === "done" && lastReport) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Report submitted</h2>
        <p className="text-sm text-[var(--mx-text-muted)]">
          Tracking ID: <strong>{lastReport.trackingId}</strong>
        </p>
        <p className="text-sm">
          Status: {lastReport.status}. Corrections enter moderation and are never
          auto-published to the canonical map.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setStep("edit");
            setReportDraft({ description: "" });
          }}
        >
          Submit another
        </Button>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Review submission</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-[var(--mx-text-muted)]">Category</dt>
            <dd>{LABELS[reportDraft.category as IssueCategory]}</dd>
          </div>
          <div>
            <dt className="text-[var(--mx-text-muted)]">Location</dt>
            <dd>
              {selectedPlace?.name ??
                `${mapView.center.lat.toFixed(5)}, ${mapView.center.lng.toFixed(5)}`}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--mx-text-muted)]">Description</dt>
            <dd>{reportDraft.description}</dd>
          </div>
          {proposedName ? (
            <div>
              <dt className="text-[var(--mx-text-muted)]">Proposed name</dt>
              <dd>{proposedName}</dd>
            </div>
          ) : null}
        </dl>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStep("edit")}>
            Back
          </Button>
          <Button className="flex-1" disabled={loading} onClick={() => void submit()}>
            {loading ? "Submitting…" : "Confirm submit"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Report an issue</h2>
        <p className="text-sm text-[var(--mx-text-muted)]">
          Magnexis Community Intelligence — propose geographic corrections with
          provenance and moderation.
        </p>
      </div>

      <div className="space-y-2">
        <span className="block text-sm text-[var(--mx-text-muted)]">
          Quick categories
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Report category chips">
          {(
            [
              "incorrect_address",
              "road_closure",
              "incorrect_road_name",
              "permanently_closed",
              "missing_business",
              "other",
            ] as IssueCategory[]
          ).map((c) => {
            const on = reportDraft.category === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  on
                    ? "border-[var(--mx-accent)] bg-[color-mix(in_srgb,var(--mx-accent)_14%,transparent)] text-[var(--mx-text)]"
                    : "border-[var(--mx-border)] bg-[var(--mx-surface-2)] text-[var(--mx-text-muted)] hover:border-[var(--mx-accent)]"
                }`}
                onClick={() => setReportDraft({ category: c })}
              >
                {LABELS[c]}
              </button>
            );
          })}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--mx-text-muted)]">
            All categories
          </span>
          <select
            className="w-full rounded-xl border border-[var(--mx-border)] bg-[var(--mx-surface)] px-3 py-2"
            value={reportDraft.category}
            onChange={(e) => setReportDraft({ category: e.target.value })}
          >
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--mx-text-muted)]">Description</span>
        <textarea
          className="min-h-28 w-full rounded-xl border border-[var(--mx-border)] bg-[var(--mx-surface)] px-3 py-2"
          value={reportDraft.description}
          onChange={(e) => setReportDraft({ description: e.target.value })}
          placeholder="Describe the geographic error and any proposed correction…"
        />
      </label>

      <Input
        placeholder="Optional proposed name / corrected value"
        value={proposedName}
        onChange={(e) => setProposedName(e.target.value)}
      />

      <Input
        type="email"
        placeholder="Guest email (if not signed in)"
        value={guestEmail}
        onChange={(e) => setGuestEmail(e.target.value)}
      />

      <p className="text-xs text-[var(--mx-text-muted)]">
        Location:{" "}
        {selectedPlace
          ? selectedPlace.name
          : `map center ${mapView.center.lat.toFixed(5)}, ${mapView.center.lng.toFixed(5)}`}
      </p>

      <Button
        className="w-full"
        disabled={reportDraft.description.trim().length < 10}
        onClick={() => setStep("review")}
      >
        Review submission
      </Button>
    </div>
  );
}
