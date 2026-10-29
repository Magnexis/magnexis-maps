"use client";

import { useEffect, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Network } from "@capacitor/network";
import { incomingAppLink } from "@/lib/share-links";

/** Native-only integration; every product screen continues to come from web. */
export function NativePlatform() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const handles: PluginListenerHandle[] = [];
    const retain = (handle: PluginListenerHandle) => {
      if (disposed) void handle.remove();
      else handles.push(handle);
    };
    const open = (url: string) => {
      const target = incomingAppLink(url);
      if (target && `${location.pathname}${location.search}` !== target)
        location.assign(target);
    };
    const unavailable = () =>
      console.warn("A native platform capability is unavailable.");
    void App.getLaunchUrl()
      .then((launch) => {
        if (!disposed && launch) open(launch.url);
      })
      .catch(unavailable);
    void App.addListener("appUrlOpen", ({ url }) => open(url))
      .then(retain)
      .catch(unavailable);
    void Network.getStatus()
      .then((status) => {
        if (!disposed) setOffline(!status.connected);
      })
      .catch(unavailable);
    void Network.addListener("networkStatusChange", (status) => {
      setOffline(!status.connected);
      window.dispatchEvent(new Event(status.connected ? "online" : "offline"));
    })
      .then(retain)
      .catch(unavailable);
    const externalLink = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;
      const url = new URL(anchor.href, location.href);
      if (
        url.origin === location.origin ||
        !["http:", "https:"].includes(url.protocol)
      )
        return;
      event.preventDefault();
      void Browser.open({ url: url.href }).catch(() => {
        window.alert("This link could not be opened. Please try again.");
      });
    };
    document.addEventListener("click", externalLink, true);
    return () => {
      disposed = true;
      handles.forEach((handle) => {
        void handle.remove();
      });
      document.removeEventListener("click", externalLink, true);
    };
  }, []);
  return offline ? (
    <div
      role="status"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-xl border border-[var(--mx-border)] bg-[var(--mx-surface)] px-4 py-3 text-sm text-[var(--mx-text)] shadow-lg"
    >
      You’re offline. Saved places and settings remain available. Maps, search,
      and new routes need a connection.
    </div>
  ) : null;
}
