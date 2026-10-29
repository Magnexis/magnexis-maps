/**
 * Lightweight OSM-style `opening_hours` parser for place cards.
 * Covers 24/7, single-rule day+time ranges, and plain English fallbacks.
 * Complex multi-rule / exception syntax falls back to the raw string.
 */

export type HoursStatus = "open" | "closed" | "unknown";

export type HoursDisplay = {
  status: HoursStatus;
  /** Short status for the badge, e.g. "Open" / "Closed" / "Opens at 9:00 AM". */
  label: string;
  /** Original hours string when present. */
  raw: string;
};

const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

const DAY_TOKEN = "su|mo|tu|we|th|fr|sa";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${pad2(m)} ${ampm}`;
}

function expandDayRange(start: string, end?: string): number[] {
  const a = DAY_INDEX[start.toLowerCase()];
  if (a === undefined) return [];
  if (!end) return [a];
  const b = DAY_INDEX[end.toLowerCase()];
  if (b === undefined) return [a];
  const days: number[] = [];
  let cur = a;
  for (let i = 0; i < 7; i++) {
    days.push(cur);
    if (cur === b) break;
    cur = (cur + 1) % 7;
  }
  return days;
}

type TimeWindow = { open: number; close: number };

type DayRule = {
  days: Set<number>;
  windows: TimeWindow[];
};

function parseTime(token: string): number | null {
  const m = token.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  if (h === 24 && min !== 0) return null;
  return Math.min(h * 60 + min, 24 * 60);
}

function parseTimeWindow(part: string): TimeWindow | null {
  const bits = part.split("-").map((s) => s.trim());
  if (bits.length !== 2) return null;
  const open = parseTime(bits[0]!);
  const close = parseTime(bits[1]!);
  if (open === null || close === null) return null;
  return { open, close };
}

/**
 * Parse a single OSM rule like `Mo-Fr 09:00-17:00` or `Sa,Su 10:00-14:00`.
 * Returns null when the rule is too complex for this parser.
 */
function parseSimpleRule(rule: string): DayRule | null {
  const trimmed = rule.trim();
  if (!trimmed || /PH|SH|off|unknown|sunrise|sunset|\+/i.test(trimmed)) {
    return null;
  }

  // Day list + optional time windows
  const dayRe = new RegExp(
    `^(?:(${DAY_TOKEN})(?:-(${DAY_TOKEN}))?)(?:,\\s*(${DAY_TOKEN})(?:-(${DAY_TOKEN}))?)*`,
    "i",
  );
  const dayMatch = trimmed.match(dayRe);
  if (!dayMatch) return null;

  const dayPart = dayMatch[0];
  const rest = trimmed.slice(dayPart.length).trim();
  if (!rest) return null; // day-only rules without times — treat as unknown

  const days = new Set<number>();
  const dayChunks = dayPart.split(/\s*,\s*/);
  for (const chunk of dayChunks) {
    const range = chunk.match(
      new RegExp(`^(${DAY_TOKEN})(?:-(${DAY_TOKEN}))?$`, "i"),
    );
    if (!range) return null;
    for (const d of expandDayRange(range[1]!, range[2])) days.add(d);
  }

  const windows: TimeWindow[] = [];
  for (const part of rest.split(/\s*,\s*/)) {
    const win = parseTimeWindow(part);
    if (!win) return null;
    windows.push(win);
  }
  if (!windows.length) return null;
  return { days, windows };
}

function isOpenInWindows(nowMin: number, windows: TimeWindow[]): boolean {
  for (const w of windows) {
    if (w.close > w.open) {
      if (nowMin >= w.open && nowMin < w.close) return true;
    } else if (w.close < w.open) {
      // Crosses midnight, e.g. 22:00-02:00
      if (nowMin >= w.open || nowMin < w.close) return true;
    } else if (w.open === 0 && w.close === 24 * 60) {
      return true;
    }
  }
  return false;
}

function nextOpenLabel(
  now: Date,
  rules: DayRule[],
): string | null {
  const startDay = now.getDay();
  const startMin = minutesOfDay(now);

  for (let offset = 0; offset < 7; offset++) {
    const day = (startDay + offset) % 7;
    for (const rule of rules) {
      if (!rule.days.has(day)) continue;
      for (const w of rule.windows) {
        if (offset === 0) {
          if (w.close > w.open) {
            if (startMin < w.open) return `Opens at ${formatClock(w.open)}`;
          } else if (w.close < w.open) {
            // overnight: if currently in the closed daytime gap, opens at evening
            if (startMin >= w.close && startMin < w.open) {
              return `Opens at ${formatClock(w.open)}`;
            }
          }
        } else {
          return `Opens at ${formatClock(w.open)}`;
        }
      }
    }
  }
  return null;
}

function isAlwaysOpen(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return (
    t === "24/7" ||
    t === "open 24 hours" ||
    t === "24 hours" ||
    t === "always open" ||
    /^mo-su\s+00:00-24:00$/i.test(t) ||
    /^mo-su\s+00:00-00:00$/i.test(t)
  );
}

/**
 * Derive open/closed status from a free-text or OSM opening_hours string.
 * Unparseable values keep status "unknown" and use the raw string as label.
 */
export function evaluateOpeningHours(
  raw: string,
  now: Date = new Date(),
): HoursDisplay {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { status: "unknown", label: "", raw: "" };
  }

  if (isAlwaysOpen(trimmed)) {
    return { status: "open", label: "Open 24 hours", raw: trimmed };
  }

  // Split on `;` — only accept when every rule parses simply
  const parts = trimmed
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const rules: DayRule[] = [];
  for (const part of parts) {
    const rule = parseSimpleRule(part);
    if (!rule) {
      return { status: "unknown", label: trimmed, raw: trimmed };
    }
    rules.push(rule);
  }

  if (!rules.length) {
    return { status: "unknown", label: trimmed, raw: trimmed };
  }

  const day = now.getDay();
  const nowMin = minutesOfDay(now);
  const todays = rules.filter((r) => r.days.has(day));

  for (const rule of todays) {
    if (isOpenInWindows(nowMin, rule.windows)) {
      return { status: "open", label: "Open", raw: trimmed };
    }
  }

  const opens = nextOpenLabel(now, rules);
  if (opens) {
    return { status: "closed", label: opens, raw: trimmed };
  }
  return { status: "closed", label: "Closed", raw: trimmed };
}
