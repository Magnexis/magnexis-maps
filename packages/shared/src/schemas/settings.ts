import { z } from "zod";
import { TRAVEL_MODES } from "../constants.js";

export const UserSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  units: z.enum(["metric", "imperial"]).default("imperial"),
  mapStyle: z
    .enum(["standard", "dark", "terrain", "satellite", "hybrid"])
    .default("dark"),
  /** Magnexis Chromatic appearance preset */
  chromaticTheme: z
    .enum(["standard", "night", "navigation", "high-contrast"])
    .default("night"),
  preferredTravelMode: z.enum(TRAVEL_MODES).default("driving"),
  voiceGuidanceEnabled: z.boolean().default(true),
  voiceRate: z.number().min(0.5).max(2).default(1),
  voiceVerbosity: z.enum(["brief", "normal", "detailed"]).default("normal"),
  reducedMotion: z.boolean().default(false),
  labelSize: z.enum(["small", "medium", "large"]).default("medium"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  showPoi: z.boolean().default(true),
  /** POI density: all | essential symbols only | hidden */
  poiDensity: z.enum(["all", "essential", "hidden"]).default("all"),
  showHighwayShields: z.boolean().default(true),
  showRoadNames: z.boolean().default(true),
  showBuildingFootprints: z.boolean().default(true),
  /** Apple Maps–style extruded buildings (fill-extrusion). */
  buildings3d: z.boolean().default(false),
  showCommunity: z.boolean().default(true),

  showIncidents: z.boolean().default(true),
  autoFollow: z.boolean().default(true),
  hapticCues: z.boolean().default(true),

  /** Route options (Google Maps–style). Applied on the next route request. */
  avoidHighways: z.boolean().default(false),
  avoidTolls: z.boolean().default(false),
  avoidFerries: z.boolean().default(false),
  /** Prefer fastest (time) or shortest (distance). Provider support varies. */
  routePreference: z.enum(["fastest", "shortest"]).default("fastest"),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = UserSettingsSchema.parse({});
