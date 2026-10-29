"use client";

import { useEffect, useState } from "react";
import type { Place } from "@magnexis/shared";
import {
  resolvePlacePhotos,
  type PlacePhoto,
  type PlacePhotoIntent,
  type PlacePhotoSource,
} from "@/lib/place-photo";

export type UsePlacePhotoState = {
  url: string | null;
  source: PlacePhotoSource | "none";
  attribution?: string;
  loading: boolean;
  /** All real photos found (Google / Mapillary / listing / Wikimedia). */
  photos: PlacePhoto[];
  index: number;
  setIndex: (i: number) => void;
};

/**
 * Load real place photos (Google Places → Mapillary → listing → Wikimedia).
 * Never invents a placeholder image when sources miss.
 */
export function usePlacePhoto(
  lng: number | null | undefined,
  lat: number | null | undefined,
  options: {
    place?: Place | null;
    name?: string | null;
    photoUrl?: string | null;
    properties?: Record<string, unknown> | null;
    /** `map_pin` = street-level only (no city-wide Wikimedia landmark photo). */
    intent?: PlacePhotoIntent;
  } = {},
): UsePlacePhotoState {
  const { place, name, photoUrl, properties, intent = "place" } = options;
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(
    Boolean(lng != null && lat != null),
  );

  const mergedProperties = properties ?? place?.properties ?? null;
  const propsKey = mergedProperties
    ? JSON.stringify({
        photoUrl: mergedProperties.photoUrl,
        image: mergedProperties.image,
        image_url: mergedProperties.image_url,
        wikimedia: mergedProperties.wikimedia,
        wikipedia: mergedProperties.wikipedia,
      })
    : "";

  useEffect(() => {
    if (
      lng == null ||
      lat == null ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat)
    ) {
      setPhotos([]);
      setIndex(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setIndex(0);
    void resolvePlacePhotos({
      lng,
      lat,
      name: name ?? place?.name,
      photoUrl: photoUrl ?? place?.photoUrl,
      properties: mergedProperties,
      intent,
    }).then((result) => {
      if (cancelled) return;
      setPhotos(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // propsKey stands in for properties identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lng,
    lat,
    name,
    photoUrl,
    place?.id,
    place?.photoUrl,
    propsKey,
    intent,
  ]);

  const safeIndex =
    photos.length === 0 ? 0 : Math.min(Math.max(0, index), photos.length - 1);
  const current = photos[safeIndex];

  return {
    url: current?.url ?? null,
    source: current?.source ?? "none",
    attribution: current?.attribution,
    loading,
    photos,
    index: safeIndex,
    setIndex: (i: number) => {
      if (photos.length === 0) return;
      setIndex(((i % photos.length) + photos.length) % photos.length);
    },
  };
}
