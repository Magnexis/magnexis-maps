"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@magnexis/ui";
import { MagnexisApiError } from "@magnexis/api-client";
import { getApiClient } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { clearDeletedAccountDeviceData } from "@/lib/account-device-data";
import {
  publicGoogleClientId,
  requestGoogleIdToken,
} from "@/lib/google-oauth";
import {
  beginGitHubSignIn,
  publicGitHubClientId,
} from "@/lib/github-oauth";
import {
  beginGitLabSignIn,
  publicGitLabClientId,
} from "@/lib/gitlab-oauth";

type AuthProvider = "password" | "google" | "github" | "gitlab";

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-1.025-.013-1.86-2.782.604-3.369-1.18-3.369-1.18-.455-1.157-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.004.071 1.532 1.031 1.532 1.031.892 1.529 2.341 1.087 2.91.831.092-.646.349-1.087.635-1.337-2.22-.253-4.555-1.11-4.555-4.942 0-1.092.39-1.984 1.03-2.684-.104-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.756c.85.004 1.705.115 2.504.337 1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.203 2.394.1 2.647.64.7 1.028 1.592 1.028 2.684 0 3.841-2.339 4.686-4.566 4.935.359.31.678.92.678 1.855 0 1.34-.012 2.42-.012 2.75 0 .268.18.58.688.481A10.002 10.002 0 0022 12c0-5.523-4.477-10-10-10Z" />
    </svg>
  );
}

function GitLabMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 36 36" className="h-5 w-5">
      <path fill="#FC6D26" d="m18 33.2 6.63-20.4H11.37L18 33.2Z" />
      <path fill="#E24329" d="m18 33.2-6.63-20.4H2.08L18 33.2Z" />
      <path fill="#FC6D26" d="m2.08 12.8 2.82-8.68a1.16 1.16 0 0 1 2.2 0l2.82 8.68H2.08Z" />
      <path fill="#E24329" d="m26.08 12.8 2.82-8.68a1.16 1.16 0 0 1 2.2 0l2.82 8.68h-7.84Z" />
      <path fill="#FCA326" d="m18 33.2 6.63-20.4h9.29L18 33.2Z" />
    </svg>
  );
}

function readStoredAuthProvider(): AuthProvider {
  const stored = window.localStorage.getItem("magnexis_auth_provider");
  if (stored === "google" || stored === "github" || stored === "gitlab") {
    return stored;
  }
  return "password";
}

export function AccountPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProvider>("password");
  const [pending, setPending] = useState<
    "session" | "sign-in" | "google" | "github" | "gitlab" | "delete" | null
  >("session");
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [clearLocalPlaces, setClearLocalPlaces] = useState(true);
  const [googleClientId, setGoogleClientId] = useState<string | null>(
    publicGoogleClientId(),
  );
  const [githubClientId, setGithubClientId] = useState<string | null>(null);
  const [gitlabClientId, setGitlabClientId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const status = await getApiClient().googleAuthStatus();
        if (active && status.configured && status.clientId) {
          setGoogleClientId(status.clientId);
        }
      } catch {
        /* Google button stays hidden when status is unavailable. */
      }

      try {
        const status = await getApiClient().githubAuthStatus();
        if (active && status.configured && status.clientId) {
          setGithubClientId(status.clientId);
        } else if (active) {
          // Client ID alone is not enough — API also needs the client secret.
          setGithubClientId(null);
        }
      } catch {
        /* Fall back to public client id only when status is unavailable. */
        if (active) setGithubClientId(publicGitHubClientId());
      }

      try {
        const status = await getApiClient().gitlabAuthStatus();
        if (active && status.configured && status.clientId) {
          setGitlabClientId(status.clientId);
        } else if (active) {
          // Client ID alone is not enough — API also needs the client secret.
          setGitlabClientId(null);
        }
      } catch {
        /* Fall back to public client id only when status is unavailable. */
        if (active) setGitlabClientId(publicGitLabClientId());
      }

      try {
        if (!window.localStorage.getItem("magnexis_token")) return;
        const { user } = await getApiClient().me();
        if (active) {
          setUserLabel(user.displayName);
          setAuthProvider(readStoredAuthProvider());
        }
      } catch (failure) {
        if (!active) return;
        if (failure instanceof MagnexisApiError && failure.status === 401) {
          try {
            window.localStorage.removeItem("magnexis_token");
            window.localStorage.removeItem("magnexis_auth_provider");
          } catch {
            /* Server already rejects this session. */
          }
        } else {
          setUserLabel("Your account");
          setError(
            "Account details are unavailable. Reconnect to manage your account.",
          );
        }
      } finally {
        if (active) setPending(null);
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending("sign-in");
    setError(null);
    setMessage(null);
    try {
      const api = getApiClient();
      const result =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, displayName });
      window.localStorage.setItem("magnexis_token", result.token);
      window.localStorage.setItem("magnexis_auth_provider", "password");
      setAuthProvider("password");
      setUserLabel(result.user.displayName);
      setMessage(`Signed in as ${result.user.displayName}`);
      setPassword("");
    } catch (failure) {
      setError(
        failure instanceof MagnexisApiError
          ? failure.message
          : "Could not sign in. Check your connection and device storage, then try again.",
      );
    } finally {
      setPending(null);
    }
  }

  async function signInWithGoogle() {
    if (pending || !googleClientId) return;
    setPending("google");
    setError(null);
    setMessage(null);
    try {
      const idToken = await requestGoogleIdToken(googleClientId);
      const result = await getApiClient().loginWithGoogle({ idToken });
      window.localStorage.setItem("magnexis_token", result.token);
      window.localStorage.setItem("magnexis_auth_provider", "google");
      setAuthProvider("google");
      setUserLabel(result.user.displayName);
      setMessage(`Signed in as ${result.user.displayName}`);
    } catch (failure) {
      setError(
        failure instanceof MagnexisApiError
          ? failure.message
          : failure instanceof Error
            ? failure.message
            : "Google sign-in failed. Try again or use email and password.",
      );
    } finally {
      setPending(null);
    }
  }

  async function signInWithGitHub() {
    if (pending || !githubClientId) return;
    setPending("github");
    setError(null);
    setMessage(null);
    try {
      await beginGitHubSignIn(githubClientId);
    } catch (failure) {
      setPending(null);
      setError(
        failure instanceof Error
          ? failure.message
          : "GitHub sign-in failed. Try again or use email and password.",
      );
    }
  }

  async function signInWithGitLab() {
    if (pending || !gitlabClientId) return;
    setPending("gitlab");
    setError(null);
    setMessage(null);
    try {
      await beginGitLabSignIn(gitlabClientId);
    } catch (failure) {
      setPending(null);
      setError(
        failure instanceof Error
          ? failure.message
          : "GitLab sign-in failed. Try again or use email and password.",
      );
    }
  }

  function cancelDeletion() {
    setConfirmingDeletion(false);
    setDeletePassword("");
    setConfirmation("");
    setError(null);
  }

  function signOut() {
    try {
      window.localStorage.removeItem("magnexis_token");
      window.localStorage.removeItem("magnexis_auth_provider");
      setUserLabel(null);
      setAuthProvider("password");
      setPassword("");
      cancelDeletion();
      setMessage("Signed out.");
    } catch {
      setError(
        "Could not clear your session from device storage. Please try again.",
      );
    }
  }

  async function removeAccount(event: FormEvent) {
    event.preventDefault();
    const needsPassword =
      authProvider !== "google" &&
      authProvider !== "github" &&
      authProvider !== "gitlab";
    if (
      pending ||
      confirmation !== "DELETE" ||
      (needsPassword && !deletePassword)
    )
      return;
    setPending("delete");
    setError(null);
    setMessage(null);
    try {
      await getApiClient().deleteAccount({
        ...(needsPassword ? { password: deletePassword } : {}),
        confirmation: "DELETE",
      });
    } catch (failure) {
      setError(
        failure instanceof MagnexisApiError
          ? failure.message
          : "Deletion could not be confirmed. Reconnect and check your account before retrying.",
      );
      setPending(null);
      return;
    }

    // The server has confirmed deletion. A device-storage error must not turn
    // this into a false 'deletion failed' message or leave account UI signed in.
    let cleanupFailed = false;
    try {
      cleanupFailed =
        clearDeletedAccountDeviceData(window.localStorage, clearLocalPlaces)
          .length > 0;
    } catch {
      cleanupFailed = true;
    }
    if (clearLocalPlaces) {
      const state = useAppStore.getState();
      useAppStore.setState({
        favoritePlaces: [],
        recentPlaces: [],
        recentSearches: [],
        selectedPlace: null,
        selectedSearch: null,
        navigationActive: false,
        directions: {
          ...state.directions,
          origin: null,
          destination: null,
          waypoints: [],
          routes: [],
          selectedRouteIndex: 0,
          error: null,
        },
      });
    }
    setUserLabel(null);
    setPassword("");
    setEmail("");
    setDisplayName("");
    cancelDeletion();
    setPending(null);
    setMessage(
      cleanupFailed
        ? "Your account was deleted. Some local device data could not be cleared; remove it from device/browser storage. The old session can no longer access your account."
        : clearLocalPlaces
          ? "Your account and selected device-only places were deleted."
          : "Your account was deleted. Device-only favorites and history were kept as requested.",
    );
  }

  return (
    <div className="space-y-4">
      {!hideHeader ? (
        <h2 className="font-display text-lg font-semibold">Account</h2>
      ) : null}
      <p className="text-sm text-[var(--mx-text-muted)]">
        Sign in to save places to your account. Browsing and local favorites
        work without an account.
      </p>
      {pending === "session" ? (
        <p role="status" className="text-sm text-[var(--mx-text-muted)]">
          Checking your session…
        </p>
      ) : userLabel ? (
        <div className="space-y-5">
          <p className="text-sm">Signed in as {userLabel}</p>
          {!confirmingDeletion ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(pending)}
                onClick={signOut}
              >
                Sign out
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={Boolean(pending)}
                onClick={() => {
                  setConfirmingDeletion(true);
                  setMessage(null);
                  setError(null);
                }}
              >
                Delete account
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4 rounded-xl border border-[var(--mx-border)] p-4"
              aria-labelledby="delete-account-title"
              onSubmit={(event) => void removeAccount(event)}
            >
              <h3 id="delete-account-title" className="font-semibold">
                Permanently delete your account
              </h3>
              <p className="text-sm text-[var(--mx-text-muted)]">
                This removes your account, account saves, preferences, submitted
                reports, and evidence metadata. Sign-in access ends on all
                devices. Applied map corrections and moderation history remain
                without your account attribution. This cannot be undone.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={clearLocalPlaces}
                  disabled={Boolean(pending)}
                  onChange={(event) =>
                    setClearLocalPlaces(event.target.checked)
                  }
                />
                <span>
                  Also remove device-only favorites, Home/Work, and recent
                  searches from this device.
                </span>
              </label>
              {authProvider === "google" ||
              authProvider === "github" ||
              authProvider === "gitlab" ? (
                <p className="text-sm text-[var(--mx-text-muted)]">
                  This account uses{" "}
                  {authProvider === "google"
                    ? "Google"
                    : authProvider === "github"
                      ? "GitHub"
                      : "GitLab"} sign-in.
                  Type DELETE to confirm — no password is required.
                </p>
              ) : (
                <label className="block space-y-1 text-sm">
                  <span>Current password</span>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    maxLength={128}
                    required
                    value={deletePassword}
                    disabled={Boolean(pending)}
                    onChange={(event) => setDeletePassword(event.target.value)}
                  />
                </label>
              )}
              <label className="block space-y-1 text-sm">
                <span>Type DELETE to confirm</span>
                <Input
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={confirmation}
                  disabled={Boolean(pending)}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="danger"
                  disabled={
                    Boolean(pending) ||
                    (authProvider !== "google" &&
                      authProvider !== "github" &&
                      authProvider !== "gitlab" &&
                      !deletePassword) ||
                    confirmation !== "DELETE"
                  }
                  aria-busy={pending === "delete"}
                >
                  {pending === "delete"
                    ? "Deleting account…"
                    : "Permanently delete account"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={cancelDeletion}
                >
                  Keep my account
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "login" ? "primary" : "secondary"}
              disabled={Boolean(pending)}
              onClick={() => setMode("login")}
            >
              Sign in
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "register" ? "primary" : "secondary"}
              disabled={Boolean(pending)}
              onClick={() => setMode("register")}
            >
              Register
            </Button>
          </div>
          {mode === "register" ? (
            <label className="block space-y-1 text-sm">
              <span>Display name</span>
              <Input
                required
                maxLength={100}
                autoComplete="nickname"
                value={displayName}
                disabled={Boolean(pending)}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span>Email</span>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              disabled={Boolean(pending)}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Password</span>
            <Input
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "register" ? 10 : 1}
              maxLength={128}
              value={password}
              disabled={Boolean(pending)}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={Boolean(pending)}
            aria-busy={pending === "sign-in"}
          >
            {pending === "sign-in"
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
          {googleClientId || githubClientId || gitlabClientId ? (
            <>
              <div
                className="flex items-center gap-3 text-xs text-[var(--mx-text-muted)]"
                role="separator"
              >
                <span className="h-px flex-1 bg-[var(--mx-border)]" />
                or
                <span className="h-px flex-1 bg-[var(--mx-border)]" />
              </div>
              {googleClientId ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={Boolean(pending)}
                  aria-busy={pending === "google"}
                  onClick={() => void signInWithGoogle()}
                >
                  {pending === "google"
                    ? "Waiting for Google…"
                    : "Continue with Google"}
                </Button>
              ) : null}
              {githubClientId ? (
                <Button
                  type="button"
                  className="w-full bg-[#24292f] text-white shadow-sm hover:bg-[#32383f] focus-visible:ring-[#0969da]"
                  disabled={Boolean(pending)}
                  aria-busy={pending === "github"}
                  onClick={signInWithGitHub}
                >
                  <GitHubMark />
                  {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
                </Button>
              ) : null}
              {gitlabClientId ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full border-[#d1d5db] bg-white text-[#303030] shadow-sm hover:bg-[#f9fafb] focus-visible:ring-[#FC6D26] dark:border-[#5d6068] dark:bg-[#fff]"
                  disabled={Boolean(pending)}
                  aria-busy={pending === "gitlab"}
                  onClick={signInWithGitLab}
                >
                  <GitLabMark />
                  {pending === "gitlab" ? "Redirecting…" : "Continue with GitLab"}
                </Button>
              ) : null}
            </>
          ) : null}
        </form>
      )}
      {message ? (
        <p role="status" className="text-sm text-[var(--mx-text)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--mx-danger,#ef4444)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
