"use client";
import { useState, type FormEvent } from "react";

export default function SupportPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const body = new URLSearchParams();
    for (const [key, value] of new FormData(form))
      body.append(key, String(value));
    setPending(true);
    setError(null);
    try {
      const origin = process.env.NEXT_PUBLIC_SUPPORT_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPPORT_URL).origin
        : "";
      const response = await fetch(`${origin}/__forms.html`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!response.ok)
        throw new Error(
          "Support could not receive your message. Please retry when connected.",
        );
      setSent(true);
      form.reset();
    } catch {
      setError(
        "Your message was not confirmed. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main
      className="mx-auto min-h-[100dvh] max-w-2xl space-y-8 px-6 py-12 text-[var(--mx-text)]"
      style={{
        paddingTop: "max(3rem, env(safe-area-inset-top))",
        paddingBottom: "max(3rem, env(safe-area-inset-bottom))",
      }}
    >
      <a href="/" className="text-[var(--mx-accent)] underline">
        Back to Maps
      </a>
      <header>
        <p className="text-sm tracking-widest text-[var(--mx-text-muted)]">
          MAGNEXIS MAPS
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Help & support
        </h1>
        <p className="mt-3">
          Get help with Maps or send a problem report to Magnexis.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Before you send a report</h2>
        <p>
          For location problems, check your browser or iPhone location
          permission and try Locate again. For missing search results or routes,
          check your connection and retry. Availability depends on provider
          coverage.
        </p>
        <p>
          Saved places and recent searches on this device are separate from
          account data. To delete your account, open Account, sign in, and
          choose Delete account. Confirm with your password and type DELETE.
        </p>
        <p>
          Maps is not an emergency service. Always follow road signs and local
          conditions. Offline map downloads and background navigation are not
          available.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Contact support</h2>
        <p>
          Include what you expected, what happened, and your browser or
          iPhone/iOS version. Do not include passwords, API keys, or precise
          home/work locations. Your email and message are sent to Magnexis
          through Netlify Forms; see our{" "}
          <a href="/privacy/" className="underline">
            privacy policy
          </a>
          .
        </p>
        {sent ? (
          <p role="status">
            Your support request was sent. Magnexis cannot promise an immediate
            response.
          </p>
        ) : (
          <form
            name="maps-support"
            method="POST"
            action="/__forms.html"
            onSubmit={submit}
            data-netlify="true"
            netlify-honeypot="website"
            className="space-y-4"
          >
            <input type="hidden" name="form-name" value="maps-support" />
            <p hidden>
              <label>
                Leave this blank
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </p>
            <label className="block">
              Email
              <input
                type="email"
                name="email"
                required
                maxLength={254}
                autoComplete="email"
                className="mt-2 block w-full rounded-lg border border-[var(--mx-border)] bg-[var(--mx-bg)] px-3 py-3"
              />
            </label>
            <label className="block">
              Topic
              <select
                name="topic"
                required
                className="mt-2 block w-full rounded-lg border border-[var(--mx-border)] bg-[var(--mx-bg)] px-3 py-3"
              >
                <option>Bug report</option>
                <option>Account or privacy request</option>
                <option>Accessibility</option>
                <option>Other</option>
              </select>
            </label>
            <label className="block">
              Message
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={5000}
                rows={6}
                className="mt-2 block w-full rounded-lg border border-[var(--mx-border)] bg-[var(--mx-bg)] px-3 py-3"
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[var(--mx-accent)] px-5 py-3 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {pending ? "Sending…" : "Send to support"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
