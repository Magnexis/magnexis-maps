"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { NavigationPage } from "@/components/navigation/navigation-page";
import { hydrateSettingsFromLocalStorage, useAppStore } from "@/lib/store";

const MapCanvas = dynamic(
  () => import("@/components/map/map-canvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[var(--mx-bg)] text-sm text-[var(--mx-text-muted)]">
        Loading navigation map…
      </div>
    ),
  },
);

/**
 * Dedicated turn-by-turn route — full page in the Next.js stack, not a
 * translucent overlay on the home map (Google Maps–style navigation screen).
 */
export default function NavigateRoutePage() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    hydrateSettingsFromLocalStorage();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    useAppStore.getState().setNavigationActive(true);
    return () => {
      // Leaving the page (back button, etc.) clears nav mode
      useAppStore.getState().setNavigationActive(false);
    };
  }, []);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--mx-bg)]">
      <MapCanvas />
      <NavigationPage />
    </div>
  );
}
