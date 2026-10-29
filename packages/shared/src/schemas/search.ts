import { z } from "zod";
import { PlaceCategorySchema } from "./places.js";
import { CoordinatesSchema } from "./geo.js";

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  lng: z.coerce.number().min(-180).max(180).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  category: PlaceCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const GeocodeQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  biasLng: z.coerce.number().min(-180).max(180).optional(),
  biasLat: z.coerce.number().min(-90).max(90).optional(),
});

export const ReverseGeocodeQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
});

export const SearchResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["place", "geocode", "category"]),
  category: PlaceCategorySchema.optional(),
  coordinates: CoordinatesSchema,
  address: z.string().optional(),
  distanceMeters: z.number().optional(),
  source: z.enum(["internal", "geocoder", "user_submission"]),
  verified: z.boolean().default(false),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
