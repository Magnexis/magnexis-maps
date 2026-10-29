const STATE_KEY = "magnexis_github_oauth_state";
const RETURN_KEY = "magnexis_github_oauth_return";

export function publicGitHubClientId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID?.trim();
  return fromEnv || null;
}

export function githubRedirectUri(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/github/callback`;
}

export function beginGitHubSignIn(clientId: string): void {
  const state =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(
    RETURN_KEY,
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: githubRedirectUri(),
    scope: "read:user user:email",
    state,
    allow_signup: "true",
  });
  window.location.assign(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  );
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
