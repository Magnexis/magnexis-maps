/**
 * Pull phone / website / hours from place.properties when present
 * (OSM tags, import metadata, or seed data). Never invents contact info.
 */

import {
  evaluateOpeningHours,
  type HoursDisplay,
} from "@/lib/opening-hours";

export type PlaceContact = {
  phone?: string;
  website?: string;
  hours?: string;
  /** Parsed open/closed status when hours are present. */
  hoursDisplay?: HoursDisplay;
};

const PHONE_KEYS = [
  "phone",
  "telephone",
  "tel",
  "contact:phone",
  "contact_phone",
  "phone_number",
] as const;

const WEBSITE_KEYS = [
  "website",
  "url",
  "contact:website",
  "contact_website",
  "homepage",
  "web",
] as const;

const HOURS_KEYS = [
  "opening_hours",
  "openingHours",
  "hours",
  "business_hours",
  "open_hours",
] as const;

function firstString(
  properties: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeWebsite(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function extractPlaceContact(
  properties?: Record<string, unknown> | null,
): PlaceContact {
  if (!properties || typeof properties !== "object") return {};
  const phone = firstString(properties, PHONE_KEYS);
  const websiteRaw = firstString(properties, WEBSITE_KEYS);
  const hours = firstString(properties, HOURS_KEYS);
  return {
    phone,
    website: websiteRaw ? normalizeWebsite(websiteRaw) : undefined,
    hours,
    hoursDisplay: hours ? evaluateOpeningHours(hours) : undefined,
  };
}

/** Badge + detail line for hours (Open / Closed / Opens at …, else raw). */
export function formatHoursLines(contact: PlaceContact): {
  badge?: string;
  detail?: string;
  status: HoursDisplay["status"];
} {
  const display = contact.hoursDisplay;
  if (!display?.raw) return { status: "unknown" };
  if (display.status === "unknown") {
    return { status: "unknown", detail: display.raw };
  }
  return {
    status: display.status,
    badge: display.label,
    detail: display.raw,
  };
}

export function placePhoneHref(phone: string): string {
  return telHref(phone);
}
