import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import type { Pool } from "pg";
import { ZodError } from "zod";
import { MagnexisError, PRODUCT_NAME, PRODUCT_VERSION } from "@magnexis/shared";
import {
  createGeocodingProvider,
  createRoutingProvider,
  resolveMapStyles,
} from "@magnexis/provider-adapters";
import type { AppConfig } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPlaceRoutes } from "./routes/places.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerRouteRoutes } from "./routes/routes.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAccountDeletionRoutes } from "./routes/account-deletion.js";
import { registerIncidentRoutes } from "./routes/incidents.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerMapStyleRoutes } from "./routes/map-styles.js";
import { registerTomTomProxyRoutes } from "./routes/tomtom-proxy.js";
import { registerGoogleProxyRoutes } from "./routes/google-proxy.js";
import { registerTtsRoutes } from "./routes/tts.js";
import { registerHotspotRoutes } from "./routes/hotspots.js";
import { authPlugin } from "./plugins/auth.js";

export type AppDeps = {
  config: AppConfig;
  pool: Pool;
};

export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    disableRequestLogging: true,
    logger: {
      level: deps.config.logLevel,
    },
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: deps.config.corsOrigin.split(",").map((s) => s.trim()),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "DELETE", "OPTIONS"],
  });

  await app.register(rateLimit, {
    max: deps.config.rateLimitMax,
    timeWindow: deps.config.rateLimitWindowMs,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: `${PRODUCT_NAME} API`,
        version: PRODUCT_VERSION,
        description:
          "REST API for Magnexis Maps — places, search, routing, community corrections.",
      },
      servers: [{ url: `http://localhost:${deps.config.port}` }],
    },
  });

  if (deps.config.nodeEnv !== "production") {
    const { default: swaggerUi } = await import("@fastify/swagger-ui");
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }

  const geocoder = createGeocodingProvider();
  const router = createRoutingProvider();
  const mapStyles = resolveMapStyles();

  app.decorate("db", deps.pool);
  app.decorate("config", deps.config);
  app.decorate("geocoder", geocoder);
  app.decorate("router", router);
  app.decorate("mapStyles", mapStyles);

  // Register on the shared instance so sibling routes receive the auth hook.
  await authPlugin(app);

  await registerHealthRoutes(app);
  await registerPlaceRoutes(app);
  await registerHotspotRoutes(app);
  await registerSearchRoutes(app);
  await registerRouteRoutes(app);
  await registerReportRoutes(app);
  await registerAuthRoutes(app);
  await registerAccountDeletionRoutes(app);
  await registerIncidentRoutes(app);
  await registerAdminRoutes(app);
  await registerMapStyleRoutes(app);
  await registerTomTomProxyRoutes(app);
  await registerGoogleProxyRoutes(app);
  await registerTtsRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Check the submitted information and try again.",
        code: "VALIDATION_ERROR",
        details: error.issues.map(({ path, message, code }) => ({ path, message, code })),
      });
    }
    if (error instanceof MagnexisError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: (error as { validation: unknown }).validation,
      });
    }

    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      const err = error as { message?: string; code?: string };
      return reply.status(statusCode).send({
        error: err.message ?? "Bad request",
        code: err.code ?? "BAD_REQUEST",
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
    config: AppConfig;
    geocoder: ReturnType<typeof createGeocodingProvider>;
    router: ReturnType<typeof createRoutingProvider>;
    mapStyles: ReturnType<typeof resolveMapStyles>;
  }
}
