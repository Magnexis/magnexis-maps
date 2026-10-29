import { z } from "zod";
import { TRAVEL_MODES } from "../constants.js";
import { CoordinatesSchema } from "./geo.js";

export const TravelModeSchema = z.enum(TRAVEL_MODES);

export const RoutePreferenceSchema = z.enum(["fastest", "shortest"]);

export const RouteAvoidOptionsSchema = z.object({
  avoidHighways: z.boolean().default(false),
  avoidTolls: z.boolean().default(false),
  avoidFerries: z.boolean().default(false),
  routePreference: RoutePreferenceSchema.default("fastest"),
});

export type RouteAvoidOptions = z.infer<typeof RouteAvoidOptionsSchema>;

export const RouteRequestSchema = z.object({
  origin: CoordinatesSchema,
  destination: CoordinatesSchema,
  mode: TravelModeSchema.default("driving"),
  waypoints: z.array(CoordinatesSchema).max(20).optional(),
  alternatives: z.boolean().default(false),
  avoidHighways: z.boolean().default(false),
  avoidTolls: z.boolean().default(false),
  avoidFerries: z.boolean().default(false),
  routePreference: RoutePreferenceSchema.default("fastest"),
});

export type RouteRequest = z.infer<typeof RouteRequestSchema>;

export const ManeuverSchema = z.object({
  instruction: z.string(),
  type: z.string().optional(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  coordinates: CoordinatesSchema.optional(),
});

export const RouteSchema = z.object({
  id: z.string(),
  mode: TravelModeSchema,
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
  }),
  maneuvers: z.array(ManeuverSchema),
  provider: z.string(),
  /** True when the provider applied live traffic (e.g. TomTom traffic=true). */
  trafficAware: z.boolean(),
  /** Extra seconds from congestion when the provider reports it (TomTom). */
  trafficDelaySeconds: z.number().nonnegative().optional(),
  summary: z.string().optional(),
});

export type Route = z.infer<typeof RouteSchema>;

export const RouteResponseSchema = z.object({
  routes: z.array(RouteSchema),
  trafficAware: z.boolean(),
});
