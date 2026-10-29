import { z } from "zod";
import { PLACE_CATEGORIES } from "../constants.js";
import { CoordinatesSchema, BBoxSchema } from "./geo.js";

export const PlaceCategorySchema = z.enum(PLACE_CATEGORIES);

export const PlaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: PlaceCategorySchema,
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  coordinates: CoordinatesSchema,
  sourceName: z.string(),
  sourceId: z.string().nullable().optional(),
  sourceDatasetVersion: z.string().nullable().optional(),
  importedAt: z.string().datetime(),
  lastVerifiedAt: z.string().datetime().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  status: z.enum(["active", "closed", "pending", "deleted"]),
  /** Optional known photo URL from import / OSM Wikimedia tags. */
  photoUrl: z.string().url().nullable().optional(),
  properties: z.record(z.unknown()).optional(),
});

export type Place = z.infer<typeof PlaceSchema>;

export const PlacesQuerySchema = z.object({
  bbox: BBoxSchema.optional(),
  category: PlaceCategorySchema.optional(),
  q: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const NearbyQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radiusMeters: z.coerce.number().min(1).max(50_000).default(2000),
  category: PlaceCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
