"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnexisApiError } from "@magnexis/api-client";
import { getApiClient } from "@/lib/api";
import {
  consumeGitLabOAuthCallback,
  isNativeGitLabOAuthState,
} from "@/lib/gitlab-oauth";

export default function GitLabOAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function finish() {
      try {
        if (isNativeGitLabOAuthState(new URLSearchParams(window.location.search).get("state"))) {
          window.location.replace(`magnexis-maps://auth/gitlab/callback${window.location.search}`);
          return;
        }
        const { code, redirectUri, returnPath } = consumeGitLabOAuthCallback(
          window.location.search,
        );
        const result = await getApiClient().loginWithGitLab({
          code,
          redirectUri,
        });
        window.localStorage.setItem("magnexis_token", result.token);
        window.localStorage.setItem("magnexis_auth_provider", "gitlab");
        if (!active) return;
        router.replace(returnPath || "/");
      } catch (failure) {
        if (!active) return;
        setError(
          failure instanceof MagnexisApiError
            ? failure.message
            : failure instanceof Error
              ? failure.message
              : "GitLab sign-in failed.",
        );
      }
    }
    void finish();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-3 px-6 py-16">
      <h1 className="font-display text-xl font-semibold">GitLab sign-in</h1>
      {error ? (
        <>
          <p role="alert" className="text-sm text-[var(--mx-danger,#ef4444)]">
            {error}
          </p>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => router.replace("/")}
          >
            Back to maps
          </button>
        </>
      ) : (
        <p role="status" className="text-sm text-[var(--mx-text-muted)]">
          Completing GitLab sign-in…
        </p>
      )}
    </main>
  );
}
