import type { CreateReport } from "@magnexis/shared";

export type AutomatedRecommendation = {
  flags: string[];
  priority: "low" | "normal" | "high";
  notes: string[];
  /** Never treat this as authority to publish. */
  autoPublish: false;
};

/**
 * Deterministic rule-based checks. Recommendations are advisory only.
 */
export function evaluateReportHeuristics(
  report: CreateReport,
): AutomatedRecommendation {
  const flags: string[] = [];
  const notes: string[] = [];

  if (!report.description || report.description.trim().length < 10) {
    flags.push("missing_required_fields");
  }

  const { lng, lat } = report.coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    flags.push("invalid_coordinates");
  }

  // Rough CT/US sanity — outside world still allowed but flagged for review
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) {
    flags.push("implausible_coordinates");
    notes.push("Coordinates near null island.");
  }

  if (report.proposedChanges) {
    for (const [key, value] of Object.entries(report.proposedChanges)) {
      if (typeof value === "string" && value.length > 500) {
        flags.push("implausible_proposed_values");
        notes.push(`Field '${key}' unusually long.`);
      }
    }
  }

  const spammy =
    /(https?:\/\/|crypto|viagra|free money)/i.test(report.description) ||
    report.description.split(" ").length < 3;
  if (spammy) {
    flags.push("possible_spam");
  }

  let priority: AutomatedRecommendation["priority"] = "normal";
  if (flags.includes("possible_spam") || flags.includes("invalid_coordinates")) {
    priority = "low";
  }
  if (
    report.category === "road_closure" ||
    report.category === "incorrect_one_way"
  ) {
    priority = "high";
  }

  return {
    flags,
    priority,
    notes,
    autoPublish: false,
  };
}
