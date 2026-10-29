import type { FastifyInstance } from "fastify";
import {
  readTomTomApiKey,
  tomtomKeyConfigured,
  findNearbyTomTomPlace,
  fetchTomTomPoiPhotoMedia,
  tomtomCategorySearch,
  tomtomSearchAlongRoute,
  tomtomReverseWithSpeedLimit,
} from "@magnexis/provider-adapters";

/**
 * Proxy TomTom traffic tiles + Search/POI enrichment so the browser never
 * needs NEXT_PUBLIC_TOMTOM_KEY for photos, parking, or along-route search.
 */
export async function registerTomTomProxyRoutes(app: FastifyInstance) {
  app.get("/api/v1/providers/tomtom/status", async (_req, reply) => {
    const configured = tomtomKeyConfigured();
    return reply.send({
      configured,
      /** Never echo the key — only whether server-side TOMTOM_API_KEY is set. */
      uses: configured
        ? [
            "routing",
            "search",
            "reverse-geocode",
            "traffic-tiles-proxy",
            "poi-photos",
            "poi-details",
            "category-search",
            "search-along-route",
            "speed-limit",
          ]
        : [],
      hint: configured
        ? null
        : "Set TOMTOM_API_KEY in the repo-root .env (server only), then restart the API. Run: pnpm secrets:tomtom",
    });
  });

  /**
   * Resolve nearby TomTom POI details + photo proxy URLs.
   * GET /api/v1/tomtom/place-photo?lng=&lat=&name=
   */
  app.get<{
    Querystring: { lng?: string; lat?: string; name?: string };
  }>("/api/v1/tomtom/place-photo", async (request, reply) => {
    const key = readTomTomApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "TomTom is not configured on the server",
        code: "PROVIDER_UNAVAILABLE",
      });
    }
    const lng = Number(request.query.lng);
    const lat = Number(request.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return reply.status(400).send({
        error: "lng and lat are required",
        code: "VALIDATION_ERROR",
      });
    }

    const details = await findNearbyTomTomPlace(key, lng, lat, {
      name: request.query.name,
      radiusMeters: 150,
    });
    if (!details) {
      return reply.status(404).send({
        error: "No TomTom place nearby",
        code: "NOT_FOUND",
      });
    }

    const photoId = details.photoIds[0];
    return reply.send({
      source: "tomtom",
      attribution: "TomTom",
      placeId: details.id,
      name: details.name,
      phone: details.phone,
      url: details.url,
      openingHours: details.openingHours,
      address: details.address,
      photoId: photoId ?? null,
      urlPath: photoId
        ? `/api/v1/tomtom/poi-photo/${encodeURIComponent(photoId)}`
        : null,
      /** True when a photo media URL is available to proxy. */
      hasPhoto: Boolean(photoId),
    });
  });

  /** Stream a TomTom POI photo by id. */
  app.get<{
    Params: { photoId: string };
    Querystring: { height?: string };
  }>("/api/v1/tomtom/poi-photo/:photoId", async (request, reply) => {
    const key = readTomTomApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "TomTom is not configured on the server",
        code: "PROVIDER_UNAVAILABLE",
      });
    }
    const photoId = decodeURIComponent(request.params.photoId ?? "").trim();
    if (!photoId) {
      return reply.status(400).send({
        error: "photoId required",
        code: "VALIDATION_ERROR",
      });
    }
    const height = Number(request.query.height ?? 640);
    const media = await fetchTomTomPoiPhotoMedia(key, photoId, {
      height: Number.isFinite(height) ? height : 640,
    });
    if (!media) {
      return reply.status(404).send({
        error: "Photo not found",
        code: "NOT_FOUND",
      });
    }
    return reply
      .header("Content-Type", media.contentType)
      .header("Cache-Control", "public, max-age=86400")
      .send(Buffer.from(media.bytes));
  });

  /** Category search (parking, gas, etc.). */
  app.get<{
    Querystring: {
      category?: string;
      lng?: string;
      lat?: string;
      radiusMeters?: string;
      limit?: string;
    };
  }>("/api/v1/tomtom/category", async (request, reply) => {
    const key = readTomTomApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "TomTom is not configured on the server",
        code: "PROVIDER_UNAVAILABLE",
      });
    }
    const lng = Number(request.query.lng);
    const lat = Number(request.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return reply.status(400).send({
        error: "lng and lat are required",
        code: "VALIDATION_ERROR",
      });
    }
    const results = await tomtomCategorySearch(
      key,
      request.query.category ?? "parking",
      lng,
      lat,
      {
        radiusMeters: Number(request.query.radiusMeters) || 1500,
        limit: Number(request.query.limit) || 8,
      },
    );
    return reply.send({ results });
  });

  /** Search along a route polyline. */
  app.post<{
    Body: {
      q?: string;
      points?: Array<{ lng: number; lat: number }>;
      maxDetourSeconds?: number;
      limit?: number;
    };
  }>("/api/v1/tomtom/along-route", async (request, reply) => {
    const key = readTomTomApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "TomTom is not configured on the server",
        code: "PROVIDER_UNAVAILABLE",
      });
    }
    const q = (request.body?.q ?? "").trim();
    const points = Array.isArray(request.body?.points)
      ? request.body.points.filter(
          (p) =>
            p &&
            Number.isFinite(p.lng) &&
            Number.isFinite(p.lat),
        )
      : [];
    if (!q || points.length < 2) {
      return reply.status(400).send({
        error: "q and at least 2 route points are required",
        code: "VALIDATION_ERROR",
      });
    }
    const results = await tomtomSearchAlongRoute(key, q, points, {
      maxDetourSeconds: request.body?.maxDetourSeconds,
      limit: request.body?.limit,
    });
    return reply.send({ results });
  });

  /** Posted speed limit near a coordinate (honest — null when unknown). */
  app.get<{
    Querystring: { lng?: string; lat?: string };
  }>("/api/v1/tomtom/speed-limit", async (request, reply) => {
    const key = readTomTomApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "TomTom is not configured on the server",
        code: "PROVIDER_UNAVAILABLE",
      });
    }
    const lng = Number(request.query.lng);
    const lat = Number(request.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return reply.status(400).send({
        error: "lng and lat are required",
        code: "VALIDATION_ERROR",
      });
    }
    const hit = await tomtomReverseWithSpeedLimit(key, lng, lat);
    return reply.send(hit);
  });

  app.get<{
    Params: { z: string; x: string; y: string };
  }>("/api/v1/tiles/tomtom/traffic/:z/:x/:y", async (request, reply) => {
    const key = readTomTomApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "TomTom is not configured on the server",
        code: "PROVIDER_UNAVAILABLE",
      });
    }

    const { z, x, y } = request.params;
    if (![z, x, y].every((p) => /^\d+$/.test(p))) {
      return reply.status(400).send({
        error: "Invalid tile coordinates",
        code: "VALIDATION_ERROR",
      });
    }

    // Strip optional .pbf suffix from y
    const yClean = y.replace(/\.pbf$/i, "");
    const upstream = `https://api.tomtom.com/traffic/map/4/tile/flow/relative/${z}/${x}/${yClean}.pbf?key=${encodeURIComponent(key)}`;

    const upstreamRes = await fetch(upstream);
    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => "");
      return reply.status(upstreamRes.status).send({
        error: "TomTom traffic tile failed",
        code: "PROVIDER_UNAVAILABLE",
        details: text.slice(0, 200),
      });
    }

    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    return reply
      .header("Content-Type", "application/vnd.mapbox-vector-tile")
      .header("Cache-Control", "public, max-age=60")
      .send(buf);
  });
}
