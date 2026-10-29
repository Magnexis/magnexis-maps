import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { serveRequest } from "./serverless.js";

describe("hosted request bridge", () => {
  it("preserves the API path, query, bearer authentication and JSON body", async () => {
    const app = Fastify();
    app.delete("/api/v1/me", async (request) => ({
      body: request.body,
      query: request.query,
      authorization: request.headers.authorization,
    }));
    const response = await serveRequest(
      app,
      new Request("https://maps.invalid/api/v1/me?check=1", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer example-test-token",
        },
        body: JSON.stringify({ password: "test-only", confirmation: "DELETE" }),
      }),
      "192.0.2.1",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      body: { password: "test-only", confirmation: "DELETE" },
      query: { check: "1" },
      authorization: "Bearer example-test-token",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    await app.close();
  });
  it("uses the platform IP rather than visitor forwarding headers", async () => {
    const app = Fastify();
    app.get("/api/v1/ip", async (request) => ({ ip: request.ip }));
    const response = await serveRequest(
      app,
      new Request("https://maps.invalid/api/v1/ip", {
        headers: { "x-forwarded-for": "spoofed" },
      }),
      "192.0.2.2",
    );
    expect(await response.json()).toEqual({ ip: "192.0.2.2" });
    await app.close();
  });
  it("preserves binary content and empty HEAD responses", async () => {
    const app = Fastify();
    app.get("/api/v1/image", async (_request, reply) =>
      reply.type("image/png").send(Buffer.from([0, 255, 128])),
    );
    const response = await serveRequest(
      app,
      new Request("https://maps.invalid/api/v1/image"),
      "192.0.2.1",
    );
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      0, 255, 128,
    ]);
    expect(response.headers.get("content-type")).toBe("image/png");
    const head = await serveRequest(
      app,
      new Request("https://maps.invalid/api/v1/image", { method: "HEAD" }),
      "192.0.2.1",
    );
    expect(await head.text()).toBe("");
    await app.close();
  });
});
