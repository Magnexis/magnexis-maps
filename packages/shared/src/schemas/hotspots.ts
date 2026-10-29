import { z } from "zod";
import { CoordinatesSchema } from "./geo.js";

/**
 * A nearby concentration of public places. This is deliberately an estimate,
 * not a claim that the product receives live device-location or footfall data.
 */
export const HotspotSchema = z.object({
  id: z.string(),
  coordinates: CoordinatesSchema,
  /** Relative, local score (0–100); comparable only within one response. */
  activityScore: z.number().int().min(0).max(100),
  placeCount: z.number().int().positive(),
  label: z.string().min(1),
});

export type Hotspot = z.infer<typeof HotspotSchema>;

export const HotspotQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radiusMeters: z.coerce.number().min(250).max(50_000).default(8_000),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});
