import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(root, ".env") });
loadEnv();

const ConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  host: z.string().default("0.0.0.0"),
  port: z.coerce.number().int().positive().default(4000),
  corsOrigin: z.string().default("http://localhost:3000"),
  databaseUrl: z
    .string()
    .default("postgresql://magnexis:magnexis@localhost:5433/magnexis_maps"),
  redisUrl: z.string().default("redis://localhost:6379"),
  jwtSecret: z.string().min(16).default("dev-only-change-me-use-long-random-string"),
  rateLimitMax: z.coerce.number().default(120),
  rateLimitWindowMs: z.coerce.number().default(60_000),
  guestReportRateLimitMax: z.coerce.number().default(5),
  logLevel: z.string().default("info"),
  googleOauthClientId: z.string().optional(),
  githubOauthClientId: z.string().optional(),
  githubOauthClientSecret: z.string().optional(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const googleOauthClientId =
    env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    undefined;
  const githubOauthClientId =
    env.GITHUB_OAUTH_CLIENT_ID?.trim() ||
    env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID?.trim() ||
    undefined;
  const githubOauthClientSecret = env.GITHUB_OAUTH_CLIENT_SECRET?.trim() || undefined;
  return ConfigSchema.parse({
    nodeEnv: env.NODE_ENV,
    host: env.API_HOST,
    port: env.API_PORT,
    corsOrigin: env.CORS_ORIGIN,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwtSecret: env.JWT_SECRET,
    rateLimitMax: env.RATE_LIMIT_MAX,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    guestReportRateLimitMax: env.GUEST_REPORT_RATE_LIMIT_MAX,
    logLevel: env.LOG_LEVEL,
    googleOauthClientId: googleOauthClientId || undefined,
    githubOauthClientId: githubOauthClientId || undefined,
    githubOauthClientSecret: githubOauthClientSecret || undefined,
  });
}
