import { z } from "zod";

export const LongitudeSchema = z.number().min(-180).max(180);
export const LatitudeSchema = z.number().min(-90).max(90);

export const CoordinatesSchema = z.object({
  lng: LongitudeSchema,
  lat: LatitudeSchema,
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const BBoxSchema = z.object({
  west: LongitudeSchema,
  south: LatitudeSchema,
  east: LongitudeSchema,
  north: LatitudeSchema,
});

export type BBox = z.infer<typeof BBoxSchema>;

export const GeoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([LongitudeSchema, LatitudeSchema]),
});

export const GeoLineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.tuple([LongitudeSchema, LatitudeSchema])).min(2),
});

export const GeoPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(
    z.array(z.tuple([LongitudeSchema, LatitudeSchema])).min(4),
  ),
});

export function haversineMeters(
  a: Coordinates,
  b: Coordinates,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isValidBBox(bbox: BBox): boolean {
  return bbox.west <= bbox.east && bbox.south <= bbox.north;
}

export function pointInBBox(point: Coordinates, bbox: BBox): boolean {
  return (
    point.lng >= bbox.west &&
    point.lng <= bbox.east &&
    point.lat >= bbox.south &&
    point.lat <= bbox.north
  );
}
