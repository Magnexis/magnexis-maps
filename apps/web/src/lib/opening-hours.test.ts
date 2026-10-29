import { describe, expect, it } from "vitest";
import { evaluateOpeningHours } from "./opening-hours";

describe("evaluateOpeningHours", () => {
  it("recognizes 24/7 as always open", () => {
    const r = evaluateOpeningHours("Open 24 hours");
    expect(r.status).toBe("open");
    expect(r.label).toBe("Open 24 hours");
  });

  it("reports open during weekday window", () => {
    // Wednesday 2026-10-21 10:30 local
    const now = new Date(2026, 9, 21, 10, 30, 0);
    const r = evaluateOpeningHours("Mo-Fr 09:00-15:00", now);
    expect(r.status).toBe("open");
    expect(r.label).toBe("Open");
  });

  it("reports opens-at when before opening", () => {
    const now = new Date(2026, 9, 21, 8, 0, 0); // Wed 8am
    const r = evaluateOpeningHours("Mo-Fr 09:00-15:00", now);
    expect(r.status).toBe("closed");
    expect(r.label).toMatch(/Opens at 9/);
  });

  it("handles Tu-Su restaurant hours", () => {
    const tuesdayOpen = new Date(2026, 9, 20, 12, 0, 0); // Tue noon
    const mondayClosed = new Date(2026, 9, 19, 12, 0, 0); // Mon noon
    expect(evaluateOpeningHours("Tu-Su 11:00-22:00", tuesdayOpen).status).toBe(
      "open",
    );
    const closed = evaluateOpeningHours("Tu-Su 11:00-22:00", mondayClosed);
    expect(closed.status).toBe("closed");
    expect(closed.label).toMatch(/Opens at/);
  });

  it("falls back to raw string when unparseable", () => {
    const raw = "Campus open; visitor centers vary by building";
    const r = evaluateOpeningHours(raw);
    expect(r.status).toBe("unknown");
    expect(r.label).toBe(raw);
  });
});
