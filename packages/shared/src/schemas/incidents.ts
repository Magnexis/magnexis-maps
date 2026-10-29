import { z } from "zod";
import { CoordinatesSchema } from "./geo.js";

export const IncidentCategorySchema = z.enum([
  "road_closure",
  "construction",
  "hazard",
  "accident",
  "weather",
  "other",
]);

export const CreateIncidentSchema = z.object({
  category: IncidentCategorySchema,
  description: z.string().min(5).max(2000),
  coordinates: CoordinatesSchema,
  expiresAt: z.string().datetime().optional(),
});

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  category: IncidentCategorySchema,
  description: z.string(),
  coordinates: CoordinatesSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  verificationStatus: z.enum(["unverified", "community", "official"]),
  source: z.string(),
});

export type Incident = z.infer<typeof IncidentSchema>;
