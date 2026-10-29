"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { getActiveRoute, useAppStore } from "@/lib/store";
import { NAVIGATE_PATH } from "@/lib/navigation-route";

/** Enter dedicated `/navigate` page when a route is ready. */
export function useStartNavigation() {
  const router = useRouter();

  return useCallback(() => {
    const { directions, setNavigationActive, setPanel } =
      useAppStore.getState();
    const route = getActiveRoute(directions);
    if (!route) return false;
    setPanel("directions");
    setNavigationActive(true);
    // Keep in-memory route state through the client transition. A hard reload
    // loses directions and sends the navigation page straight back home.
    router.push(NAVIGATE_PATH);
    return true;
  }, [router]);
}
