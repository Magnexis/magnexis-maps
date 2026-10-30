import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { publicShareBase } from "./share-links";

const STATE_KEY = "magnexis_github_oauth_state";
const RETURN_KEY = "magnexis_github_oauth_return";
const NATIVE_STATE_PREFIX = "native.";

export function publicGitHubClientId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID?.trim();
  return fromEnv || null;
}

export function githubRedirectUri(): string {
  if (typeof window === "undefined") return "";
  if (Capacitor.isNativePlatform()) {
    const publicBase = publicShareBase();
    if (!publicBase) {
      throw new Error("GitHub sign-in is not configured for the native app.");
    }
    return `${publicBase}/auth/github/callback`;
  }
  return `${window.location.origin}/auth/github/callback`;
}

export function isNativeGitHubOAuthState(state: string | null): boolean {
  return Boolean(state?.startsWith(NATIVE_STATE_PREFIX));
}

export async function beginGitHubSignIn(clientId: string): Promise<void> {
  const state =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const oauthState = Capacitor.isNativePlatform()
    ? `${NATIVE_STATE_PREFIX}${state}`
    : state;
  sessionStorage.setItem(STATE_KEY, oauthState);
  sessionStorage.setItem(
    RETURN_KEY,
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: githubRedirectUri(),
    scope: "read:user user:email",
    state: oauthState,
    allow_signup: "true",
  });
  const authorizationUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: authorizationUrl });
    return;
  }
  window.location.assign(authorizationUrl);
}

export function consumeGitHubOAuthCallback(search: string): {
  code: string;
  redirectUri: string;
  returnPath: string;
} {
  const params = new URLSearchParams(search);
  const code = params.get("code");
  const state = params.get("state");
  const expected = sessionStorage.getItem(STATE_KEY);
  const returnPath = sessionStorage.getItem(RETURN_KEY) || "/";
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(RETURN_KEY);

  if (params.get("error")) {
    throw new Error(
      params.get("error_description") ||
        "GitHub sign-in was cancelled or denied.",
    );
  }
  if (!code) throw new Error("GitHub did not return an authorization code.");
  if (!expected || !state || expected !== state) {
    throw new Error("GitHub sign-in state mismatch. Try again.");
  }

  return {
    code,
    redirectUri: githubRedirectUri(),
    returnPath: returnPath.startsWith("/") ? returnPath : "/",
  };
}
