import { describe, expect, it } from "vitest";
import { clearDeletedAccountDeviceData } from "./account-device-data";

describe("device cleanup after confirmed account deletion", () => {
  it("removes only the token when the user keeps device-only places", () => {
    const data = new Map([
      ["magnexis_token", "synthetic-token"],
      ["magnexis_favorite_places", "[]"],
      ["unrelated", "preserve"],
    ]);
    expect(
      clearDeletedAccountDeviceData(
        {
          removeItem: (key) => {
            data.delete(key);
          },
        },
        false,
      ),
    ).toEqual([]);
    expect(data.has("magnexis_token")).toBe(false);
    expect(data.has("magnexis_favorite_places")).toBe(true);
    expect(data.get("unrelated")).toBe("preserve");
  });
  it("clears selected local personal data while preserving appearance settings and unrelated storage", () => {
    const keys = [
      "magnexis_token",
      "magnexis_favorite_places",
      "magnexis_recent_searches",
      "magnexis_recent_places",
      "magnexis_home_work",
      "magnexis_settings",
      "unrelated",
    ];
    const data = new Map(keys.map((key) => [key, "test"]));
    clearDeletedAccountDeviceData(
      {
        removeItem: (key) => {
          data.delete(key);
        },
      },
      true,
    );
    expect([...data.keys()]).toEqual(["magnexis_settings", "unrelated"]);
  });
  it("reports storage failures and still attempts the remaining cleanup", () => {
    const removed: string[] = [];
    const failures = clearDeletedAccountDeviceData(
      {
        removeItem: (key) => {
          if (key === "magnexis_token") throw new Error("Storage denied");
          removed.push(key);
        },
      },
      true,
    );
    expect(failures).toEqual(["magnexis_token"]);
    expect(removed).toContain("magnexis_home_work");
  });
});
