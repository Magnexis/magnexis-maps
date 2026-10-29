import { describe, expect, it, vi } from "vitest";
import { createApiClient, MagnexisApiError } from "./index.js";

describe("account deletion contract", () => {
  it("does not confirm deletion after an invalid successful response", async () => {
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ deleted: false })),
    });
    await expect(
      client.deleteAccount({
        password: "synthetic-password",
        confirmation: "DELETE",
      }),
    ).rejects.toMatchObject({ code: "INVALID_DELETION_RESPONSE" });
  });
  it("sends confirmation to the current-account endpoint with the existing bearer token", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ deleted: true }));
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getToken: () => "synthetic-token",
      fetchImpl,
    });
    expect(
      await client.deleteAccount({
        password: "synthetic-password",
        confirmation: "DELETE",
      }),
    ).toEqual({ deleted: true });
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://api.example.test/api/v1/me",
    );
    const request = fetchImpl.mock.calls[0]![1]!;
    expect(request.method).toBe("DELETE");
    expect(new Headers(request.headers).get("Authorization")).toBe(
      "Bearer synthetic-token",
    );
    expect(JSON.parse(String(request.body))).toEqual({
      password: "synthetic-password",
      confirmation: "DELETE",
    });
  });
  it("preserves a server failure instead of reporting deletion", async () => {
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: "Password did not match", code: "FORBIDDEN" },
            { status: 403 },
          ),
        ),
    });
    await expect(
      client.deleteAccount({ password: "wrong", confirmation: "DELETE" }),
    ).rejects.toBeInstanceOf(MagnexisApiError);
  });
});
