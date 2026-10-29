import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerHotspotRoutes } from "./hotspots.js";

describe("hotspot route", () => {
  it("returns a bounded density estimate with an explicit non-footfall notice", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { id: "west", lng: -72.68, lat: 41.6, place_count: 6, label: "6 places nearby" },
        { id: "east", lng: -72.67, lat: 41.61, place_count: 3, label: "3 places nearby" },
      ],
    });
    const app = Fastify();
    app.decorate("db", { query } as never);
    await registerHotspotRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/hotspots?lng=-72.68&lat=41.60&radiusMeters=8000&limit=2",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      basis: "public_place_density",
      hotspots: [
        { id: "west", activityScore: 100, placeCount: 6 },
        { id: "east", activityScore: 65, placeCount: 3 },
      ],
    });
    expect(response.json().notice).toMatch(/not live foot-traffic/i);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("ST_SnapToGrid"), [
      -72.68,
      41.6,
      8000,
      800,
      2,
    ]);
    await app.close();
  });

  it("rejects invalid coordinates before querying data", async () => {
    const query = vi.fn();
    const app = Fastify();
    app.decorate("db", { query } as never);
    await registerHotspotRoutes(app);
    const response = await app.inject({ method: "GET", url: "/api/v1/hotspots?lng=999&lat=0" });
    expect(response.statusCode).toBe(500);
    expect(query).not.toHaveBeenCalled();
    await app.close();
  });
});
