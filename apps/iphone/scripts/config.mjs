import { isIP } from "node:net";

export function validatePublicUrl(value, name) {
  if (!value)
    throw new Error(
      `${name} must be provided before a production iPhone build.`,
    );
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const parts = host.split(".").map(Number);
  const privateIp =
    isIP(host) === 4 &&
    (parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] >= 224 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127));
  const privateV6 =
    isIP(host) === 6 &&
    (host === "::" ||
      host === "::1" ||
      /^(fc|fd|fe[89ab])/i.test(host) ||
      host.includes("ffff:"));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    privateIp ||
    privateV6 ||
    !host.includes(".") ||
    /(^|\.)(localhost|local|test|invalid|example\.com|example\.org|example\.net)$/.test(
      host,
    )
  ) {
    throw new Error(
      `${name} must be a public HTTPS URL without credentials, query parameters, or a fragment.`,
    );
  }
  return url.href.replace(/\/$/, "");
}

export function buildEnvironment(env, development = false) {
  const api = development
    ? env.IPHONE_API_URL || "http://localhost:4000"
    : validatePublicUrl(env.IPHONE_API_URL, "IPHONE_API_URL");
  const share = development
    ? env.IPHONE_SHARE_URL || "http://localhost:3000"
    : validatePublicUrl(env.IPHONE_SHARE_URL, "IPHONE_SHARE_URL");
  const privacy = development
    ? env.IPHONE_PRIVACY_URL || ""
    : validatePublicUrl(env.IPHONE_PRIVACY_URL, "IPHONE_PRIVACY_URL");
  const support = development
    ? env.IPHONE_SUPPORT_URL || ""
    : validatePublicUrl(env.IPHONE_SUPPORT_URL, "IPHONE_SUPPORT_URL");
  const googleOauth =
    env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    "";
  const githubOauth =
    env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID?.trim() ||
    env.GITHUB_OAUTH_CLIENT_ID?.trim() ||
    "";
  const gitlabOauth =
    env.NEXT_PUBLIC_GITLAB_OAUTH_CLIENT_ID?.trim() ||
    env.GITLAB_OAUTH_CLIENT_ID?.trim() ||
    "";
  const mapillary =
    env.NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN?.trim() ||
    env.MAPILLARY_ACCESS_TOKEN?.trim() ||
    "";

  return {
    ...env,
    MAGNEXIS_IPHONE_EXPORT: "1",
    NEXT_PUBLIC_NATIVE_APP: "1",
    NEXT_PUBLIC_API_URL: api,
    NEXT_PUBLIC_SHARE_URL: share,
    NEXT_PUBLIC_PRIVACY_URL: privacy,
    NEXT_PUBLIC_SUPPORT_URL: support,
    // Bake public OAuth client IDs + Mapillary into the static Capacitor export.
    // Secrets (OAuth client secrets, Google Maps server key) stay on the API/Netlify.
    ...(googleOauth
      ? { NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: googleOauth }
      : {}),
    ...(githubOauth
      ? { NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID: githubOauth }
      : {}),
    ...(gitlabOauth
      ? { NEXT_PUBLIC_GITLAB_OAUTH_CLIENT_ID: gitlabOauth }
      : {}),
    ...(mapillary
      ? { NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN: mapillary }
      : {}),
  };
}
