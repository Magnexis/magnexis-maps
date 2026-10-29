"use client";

import { useEffect, useState } from "react";
import { createApiClient } from "@magnexis/api-client";

const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  getToken: () =>
    typeof window !== "undefined"
      ? window.localStorage.getItem("magnexis_token")
      : null,
});

type Overview = {
  totalPlaces: number;
  pendingReports: number;
  failedIngestionJobs: number;
  activeIncidents: number;
  latestPlaceImportAt: string | null;
  coverage: string;
  geocoding: string;
  routing: string;
};

export default function AdminPage() {
  const [email, setEmail] = useState("admin@magnexis.local");
  const [password, setPassword] = useState("MagnexisAdmin1!");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reports, setReports] = useState<
    Array<{ id: string; trackingId: string; category: string; status: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setError(null);
    try {
      const res = await api.login({ email, password });
      window.localStorage.setItem("magnexis_token", res.token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function load() {
    try {
      const ov = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/admin/overview`,
        {
          headers: {
            Authorization: `Bearer ${window.localStorage.getItem("magnexis_token")}`,
          },
        },
      );
      if (!ov.ok) throw new Error("Overview request failed — moderator role required");
      setOverview((await ov.json()) as Overview);

      const rep = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/admin/reports`,
        {
          headers: {
            Authorization: `Bearer ${window.localStorage.getItem("magnexis_token")}`,
          },
        },
      );
      if (rep.ok) {
        const data = (await rep.json()) as { reports: typeof reports };
        setReports(data.reports);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    }
  }

  async function review(id: string, action: "approve" | "reject") {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/admin/reports/${id}/review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${window.localStorage.getItem("magnexis_token")}`,
        },
        body: JSON.stringify({ action, notes: `Admin ${action}` }),
      },
    );
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  useEffect(() => {
    if (window.localStorage.getItem("magnexis_token")) {
      void load();
    }
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 8,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          width={44}
          height={44}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <h1 style={{ letterSpacing: "0.12em", margin: 0 }}>MAGNEXIS MAPS · ADMIN</h1>
      </header>
      <p style={{ color: "#9AA8BD" }}>
        Live statistics from API state. No fabricated metrics.
      </p>

      <section
        style={{
          display: "grid",
          gap: 8,
          marginBottom: 24,
          padding: 16,
          background: "#111C2D",
          borderRadius: 12,
        }}
      >
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ padding: 8, borderRadius: 8, border: "1px solid #243347" }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ padding: 8, borderRadius: 8, border: "1px solid #243347" }}
        />
        <button
          type="button"
          onClick={() => void login()}
          style={{
            padding: 10,
            borderRadius: 8,
            border: 0,
            background: "#247BFF",
            color: "white",
            cursor: "pointer",
          }}
        >
          Sign in & load overview
        </button>
      </section>

      {error ? <p style={{ color: "#F07178" }}>{error}</p> : null}

      {overview ? (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {(
            [
              ["Places", overview.totalPlaces],
              ["Pending reports", overview.pendingReports],
              ["Failed jobs", overview.failedIngestionJobs],
              ["Active incidents", overview.activeIncidents],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#111C2D",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ color: "#9AA8BD", fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1", color: "#9AA8BD", fontSize: 14 }}>
            Coverage: {overview.coverage}
            <br />
            Latest import: {overview.latestPlaceImportAt ?? "n/a"}
            <br />
            Geocoding: {overview.geocoding} · Routing: {overview.routing}
          </div>
        </section>
      ) : null}

      <section>
        <h2>Moderation queue</h2>
        <ul style={{ listStyle: "none", padding: 0, display: 12 }}>
          {reports.map((r) => (
            <li
              key={r.id}
              style={{
                background: "#111C2D",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <strong>{r.trackingId}</strong>
                <div style={{ color: "#9AA8BD", fontSize: 13 }}>
                  {r.category} · {r.status}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => void review(r.id, "approve")}>
                  Approve
                </button>
                <button type="button" onClick={() => void review(r.id, "reject")}>
                  Reject
                </button>
              </div>
            </li>
          ))}
          {reports.length === 0 ? (
            <li style={{ color: "#9AA8BD" }}>No pending reports.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
