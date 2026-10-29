import type { FastifyInstance } from "fastify";
import {
  readGoogleMapsApiKey,
  googleMapsKeyConfigured,
  googlePlacePhotoPriority,
  findNearbyGooglePlacePhoto,
  fetchGooglePlacePhotoMedia,
  googleStreetViewAvailable,
  fetchGoogleStreetViewImage,
} from "@magnexis/provider-adapters";

/**
 * Proxy Google Places photos + Street View Static so the browser never needs
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for enrichment.
 */
export async function registerGoogleProxyRoutes(app: FastifyInstance) {
  app.get("/api/v1/providers/google/status", async (_req, reply) => {
    const configured = googleMapsKeyConfigured();
    const priority = googlePlacePhotoPriority();
    return reply.send({
      configured,
      photoPriority: priority,
      /** Never echo the key — only whether server-side GOOGLE_MAPS_API_KEY is set. */
      uses: configured
        ? [
            "places-photos",
            "street-view-static",
            "street-view-metadata",
            ...(process.env.GEOCODING_PROVIDER === "google" ||
            process.env.GEOCODING_PROVIDER === "auto"
              ? ["geocoding"]
              : []),
          ]
        : [],
      hint: configured
        ? null
        : "Set GOOGLE_MAPS_API_KEY in the repo-root .env (server only), then restart the API. Run: pnpm secrets:google",
    });
  });

  /**
   * Resolve a Places (New) photo near a coordinate.
   * Returns JSON with a same-origin media proxy URL (key stays on the API).
   */
  app.get<{
    Querystring: {
      lng?: string;
      lat?: string;
      name?: string;
      maxHeight?: string;
    };
  }>("/api/v1/google/place-photo", async (request, reply) => {
    const key = readGoogleMapsApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "Google Maps is not configured on the server",
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

    const maxHeight = Number(request.query.maxHeight ?? 800);
    const hit = await findNearbyGooglePlacePhoto(key, lng, lat, {
      name: request.query.name,
      radiusMeters: 80,
    });
    if (!hit) {
      return reply.status(404).send({
        error: "No Google place photo nearby",
        code: "NOT_FOUND",
      });
    }

    const mediaQs = new URLSearchParams({
      name: hit.photoName,
      maxHeight: String(
        Number.isFinite(maxHeight) ? Math.round(maxHeight) : 800,
      ),
    });

    return reply.send({
      source: "google",
      attribution: hit.attribution,
      placeId: hit.placeId,
      placeName: hit.placeName ?? null,
      photoName: hit.photoName,
      /** Browser-safe image URL — API injects the key server-side. */
      url: `/api/v1/google/place-photo/media?${mediaQs.toString()}`,
    });
  });

  app.get<{
    Querystring: { name?: string; maxHeight?: string };
  }>("/api/v1/google/place-photo/media", async (request, reply) => {
    const key = readGoogleMapsApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "Google Maps is not configured on the server",
        code: "PROVIDER_UNAVAILABLE",
      });
    }

    const name = request.query.name?.trim() ?? "";
    if (!name.startsWith("places/") || !name.includes("/photos/")) {
      return reply.status(400).send({
        error: "Invalid photo name",
        code: "VALIDATION_ERROR",
      });
    }

    const maxHeight = Number(request.query.maxHeight ?? 800);
    const media = await fetchGooglePlacePhotoMedia(
      key,
      name,
      Number.isFinite(maxHeight) ? maxHeight : 800,
    );
    if (!media) {
      return reply.status(404).send({
        error: "Google place photo media unavailable",
        code: "NOT_FOUND",
      });
    }

    return reply
      .header("Content-Type", media.contentType)
      .header("Cache-Control", "public, max-age=3600")
      .send(Buffer.from(media.body));
  });

  app.get<{
    Querystring: { lng?: string; lat?: string; radius?: string };
  }>("/api/v1/google/street-view/meta", async (request, reply) => {
    const key = readGoogleMapsApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "Google Maps is not configured on the server",
        code: "PROVIDER_UNAVAILABLE",
        available: false,
      });
    }

    const lng = Number(request.query.lng);
    const lat = Number(request.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return reply.status(400).send({
        error: "lng and lat are required",
        code: "VALIDATION_ERROR",
        available: false,
      });
    }

    const radius = Number(request.query.radius ?? 50);
    const meta = await googleStreetViewAvailable(
      key,
      lng,
      lat,
      Number.isFinite(radius) ? radius : 50,
    );
    return reply.send({
      available: meta.available,
      copyright: meta.copyright ?? null,
      imageUrl: meta.available
        ? `/api/v1/google/street-view?lng=${encodeURIComponent(String(lng))}&lat=${encodeURIComponent(String(lat))}&size=640x480`
        : null,
    });
  });

  app.get<{
    Querystring: {
      lng?: string;
      lat?: string;
      size?: string;
      heading?: string;
      fov?: string;
      pitch?: string;
    };
  }>("/api/v1/google/street-view", async (request, reply) => {
    const key = readGoogleMapsApiKey();
    if (!key) {
      return reply.status(503).send({
        error: "Google Maps is not configured on the server",
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

    const heading =
      request.query.heading != null ? Number(request.query.heading) : undefined;
    const fov =
      request.query.fov != null ? Number(request.query.fov) : undefined;
    const pitch =
      request.query.pitch != null ? Number(request.query.pitch) : undefined;

    const media = await fetchGoogleStreetViewImage(key, lng, lat, {
      size: request.query.size ?? "640x480",
      heading: Number.isFinite(heading) ? heading : undefined,
      fov: Number.isFinite(fov) ? fov : undefined,
      pitch: Number.isFinite(pitch) ? pitch : undefined,
    });
    if (!media) {
      return reply.status(404).send({
        error: "No Google Street View imagery at this location",
        code: "NOT_FOUND",
      });
    }

    return reply
      .header("Content-Type", media.contentType)
      .header("Cache-Control", "public, max-age=3600")
      .send(Buffer.from(media.body));
  });
}
