import { describe, expect, it } from "vitest";
import { evaluateReportHeuristics } from "./report-heuristics.js";

describe("report heuristics", () => {
  it("never recommends auto-publish", () => {
    const result = evaluateReportHeuristics({
      category: "incorrect_business_name",
      description: "The signage shows a different name than the map label.",
      coordinates: { lng: -72.9279, lat: 41.3083 },
    });
    expect(result.autoPublish).toBe(false);
  });

  it("flags null-island coordinates", () => {
    const result = evaluateReportHeuristics({
      category: "other",
      description: "Something looks wrong near these coordinates on the map.",
      coordinates: { lng: 0, lat: 0 },
    });
    expect(result.flags).toContain("implausible_coordinates");
  });
});
