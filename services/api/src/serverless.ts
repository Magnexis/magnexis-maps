import type { FastifyInstance, HTTPMethods } from "fastify";
import pg from "pg";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

export async function createHostedApp(): Promise<FastifyInstance> {
  if (
    !process.env.DATABASE_URL ||
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error("Production API credentials are not configured.");
  }
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  try {
    const app = await buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: "production" }),
      pool,
    });
    await app.ready();
    return app;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

/** Preserve binary responses, request bodies and the platform's trusted client IP. */
export async function serveRequest(
  app: FastifyInstance,
  request: Request,
  clientIp: string,
): Promise<Response> {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers);
  // Forwarding headers supplied by visitors must not influence rate limiting.
  delete headers["x-forwarded-for"];
  delete headers["x-real-ip"];
  delete headers["content-length"];
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const payload = hasBody
    ? Buffer.from(await request.arrayBuffer())
    : undefined;
  const result = await app.inject({
    method: request.method as HTTPMethods,
    url: url.pathname + url.search,
    headers,
    payload,
    remoteAddress: clientIp,
  });
  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(result.headers)) {
    if (
      value == null ||
      ["connection", "transfer-encoding", "content-length"].includes(key)
    )
      continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      responseHeaders.append(key, String(entry));
    }
  }
  responseHeaders.set("cache-control", "no-store");
  const empty =
    request.method === "HEAD" || [204, 205, 304].includes(result.statusCode);
  return new Response(empty ? null : new Uint8Array(result.rawPayload), {
    status: result.statusCode,
    headers: responseHeaders,
  });
}
