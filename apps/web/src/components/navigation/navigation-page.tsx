"use client";

import { getGeolocation } from "@/lib/geolocation";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CornerUpRight,
  Gauge,
  MapPinned,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@magnexis/ui";
import {
  createBrowserSpeechService,
  createInstructionScheduler,
} from "@magnexis/navigation";
import { getActiveRoute, useAppStore } from "@/lib/store";
import { HOME_PATH } from "@/lib/navigation-route";
import {
  formatArrivalTime,
  formatDistanceMeters,
  formatDurationSeconds,
  formatTrafficDelay,
} from "@/lib/format";
import {
  computeRouteProgress,
  formatGpsSpeed,
  formatSpeedLimit,
} from "@/lib/route-progress";
import { fetchTomTomSpeedLimit } from "@/lib/tomtom-client";
import { getMap } from "@/lib/map-registry";
import maplibregl from "maplibre-gl";

/**
 * Dedicated navigation page chrome (Google Maps–style).
 * Rendered on `/navigate` with its own map — not a translucent overlay on home.
 */
export function NavigationPage() {
  const router = useRouter();
  const {
    directions,
    setNavigationActive,
    voiceMuted,
    setVoiceMuted,
    settings,
    userLocation,
    mapView,
  } = useAppStore();
  const route = getActiveRoute(directions);
  const speech = useMemo(() => createBrowserSpeechService(), []);
  const scheduler = useMemo(() => createInstructionScheduler(), []);
  const [banner, setBanner] = useState("Navigation ready");
  const [nextInstruction, setNextInstruction] = useState(
    route?.maneuvers[0]?.instruction ?? "Follow the route",
  );
  const [overview, setOverview] = useState(false);
  const overviewRef = useRef(false);
  overviewRef.current = overview;
  const [remainingMeters, setRemainingMeters] = useState(
    route?.distanceMeters ?? 0,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    route?.durationSeconds ?? 0,
  );
  const [nextManeuverMeters, setNextManeuverMeters] = useState(0);
  const [speedLimitKph, setSpeedLimitKph] = useState<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const speedLimitAt = useRef(0);
  const units = settings.units === "metric" ? "metric" : "imperial";

  const endNavigation = () => {
    speech.stop();
    setNavigationActive(false);
    router.push(HOME_PATH);
  };

  const showRouteOverview = () => {
    const map = getMap();
    if (!map || !route?.geometry?.coordinates?.length) return;
    const coords = route.geometry.coordinates as [number, number][];
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0]!, coords[0]!),
    );
    setOverview(true);
    map.fitBounds(bounds, {
      padding: { top: 160, bottom: 120, left: 48, right: 48 },
      duration: 700,
      maxZoom: 16,
    });
  };

  useEffect(() => {
    if (!route) {
      setNavigationActive(false);
      router.replace(HOME_PATH);
    }
  }, [route, router, setNavigationActive]);

  useEffect(() => {
    if (!route) return;
    setNavigationActive(true);
    void speech.initialize();
    speech.setRate(settings.voiceRate);
    if (voiceMuted || !settings.voiceGuidanceEnabled) speech.mute();
    else speech.unmute();
    scheduler.reset();
    setRemainingMeters(route.distanceMeters);
    setRemainingSeconds(route.durationSeconds);
    setNextInstruction(route.maneuvers[0]?.instruction ?? "Follow the route");

    if (settings.voiceGuidanceEnabled && !voiceMuted && route.maneuvers[0]) {
      void speech.speak(
        `Starting navigation. ${route.maneuvers[0].instruction}`,
      );
      setBanner(route.maneuvers[0].instruction);
    }

    let disposed = false;
    const geolocation = getGeolocation();
    if (geolocation) {
      const onPosition = (pos: GeolocationPosition) => {
        if (disposed) return;
        const position = {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
          accuracy: pos.coords.accuracy,
          speedMps:
            typeof pos.coords.speed === "number" &&
            Number.isFinite(pos.coords.speed)
              ? pos.coords.speed
              : null,
        };
        useAppStore.getState().setUserLocation(position);

        const progress = computeRouteProgress(position, route);
        setRemainingMeters(progress.remainingMeters);
        setRemainingSeconds(progress.remainingSeconds);
        setNextManeuverMeters(progress.nextManeuverMeters);
        setNextInstruction(progress.nextInstruction);

        if (!overviewRef.current) {
          getMap()?.easeTo({
            center: [position.lng, position.lat],
            duration: 400,
            essential: true,
          });
        }
        const line = scheduler.tick({
          position,
          route,
          verbosity: useAppStore.getState().settings.voiceVerbosity,
        });
        if (line) {
          setBanner(line);
          setNextInstruction(line);
          if (
            useAppStore.getState().settings.voiceGuidanceEnabled &&
            !speech.isMuted()
          ) {
            void speech.speak(line);
          }
        }

        // Refresh posted speed limit occasionally (honest — hide when unknown)
        const now = Date.now();
        if (now - speedLimitAt.current > 45_000) {
          speedLimitAt.current = now;
          void fetchTomTomSpeedLimit(position.lng, position.lat).then((hit) => {
            if (!disposed) setSpeedLimitKph(hit.speedLimitKph);
          });
        }
      };
      const onError = () => {
        if (disposed) return;
        setBanner(
          "GPS unavailable — showing route overview. Voice cues pause until location returns.",
        );
        showRouteOverview();
      };
      geolocation.getCurrentPosition(
        (position) => {
          if (disposed) return;
          onPosition(position);
          watchRef.current = geolocation.watchPosition(onPosition, onError, {
            enableHighAccuracy: true,
            maximumAge: 2000,
          });
        },
        onError,
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
      );
    }

    return () => {
      disposed = true;
      speech.dispose();
      if (watchRef.current != null) {
        getGeolocation()?.clearWatch(watchRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    speech.setRate(settings.voiceRate);
    if (voiceMuted || !settings.voiceGuidanceEnabled) speech.mute();
    else speech.unmute();
  }, [voiceMuted, settings.voiceGuidanceEnabled, settings.voiceRate, speech]);

  if (!route) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--mx-bg)] text-sm text-[var(--mx-text-muted)]">
        Returning to map…
      </div>
    );
  }

  const remainingLabel = formatDurationSeconds(remainingSeconds);
  const distanceLabel = formatDistanceMeters(remainingMeters, units);
  const arrivalLabel = formatArrivalTime(remainingSeconds);
  const trafficLabel = formatTrafficDelay(route.trafficDelaySeconds);
  const position = userLocation ?? mapView.center;
  const speedLabel = formatGpsSpeed(
    userLocation?.speedMps,
    units,
    userLocation?.accuracy,
  );
  const limitLabel = formatSpeedLimit(speedLimitKph, units);
  const toTurnLabel = formatDistanceMeters(nextManeuverMeters, units);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
      {/* Solid page chrome — not a glass sheet over home */}
      <header className="pointer-events-auto shrink-0 border-b border-[var(--mx-border)] bg-[var(--mx-surface)] pt-[env(safe-area-inset-top)] shadow-[var(--mx-shadow-float)]">
        <div className="flex gap-0 bg-gradient-to-br from-[var(--mx-accent)] to-[#1a5fd4] text-white">
          <div className="flex w-[5.5rem] shrink-0 flex-col items-center justify-center border-r border-white/20 bg-black/15 px-2 py-4">
            <CornerUpRight size={28} strokeWidth={2.25} aria-hidden />
            <p className="mt-1 text-center text-sm font-semibold tabular-nums leading-tight">
              {toTurnLabel}
            </p>
            <p className="text-[10px] uppercase tracking-wider opacity-80">
              then
            </p>
          </div>
          <div className="min-w-0 flex-1 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-80">
              Next maneuver
            </p>
            <p className="mt-1 font-display text-xl font-semibold leading-snug">
              {nextInstruction}
            </p>
            <p className="mt-2 line-clamp-2 text-sm opacity-90">{banner}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 text-sm">
            <div className="font-semibold tabular-nums text-[var(--mx-text)]">
              {distanceLabel} left · {remainingLabel}
            </div>
            <div className="text-xs text-[var(--mx-text-muted)]">
              Arrive {arrivalLabel}
              {trafficLabel ? ` · ${trafficLabel}` : ""}
              {" · "}
              {route.provider}
              {userLocation ? " · GPS active" : " · map center fallback"}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="secondary"
              aria-label={overview ? "Resume following" : "Route overview"}
              title={overview ? "Resume following GPS" : "Fit whole route"}
              onClick={() => {
                if (overview && userLocation) {
                  setOverview(false);
                  getMap()?.easeTo({
                    center: [userLocation.lng, userLocation.lat],
                    zoom: Math.max(getMap()?.getZoom() ?? 15, 15),
                    duration: 500,
                    essential: true,
                  });
                  return;
                }
                showRouteOverview();
              }}
            >
              <MapPinned size={16} />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              aria-label={voiceMuted ? "Unmute voice guidance" : "Mute voice"}
              title={voiceMuted ? "Unmute" : "Mute"}
              onClick={() => {
                const next = !voiceMuted;
                setVoiceMuted(next);
                if (next) speech.mute();
                else speech.unmute();
              }}
            >
              {voiceMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </Button>
            <Button
              size="icon"
              variant="secondary"
              aria-label="Repeat instruction"
              title="Repeat"
              onClick={() => {
                if (!speech.isMuted()) void speech.speak(nextInstruction);
              }}
            >
              <RotateCcw size={16} />
            </Button>
            <Button
              size="icon"
              variant="danger"
              aria-label="Exit navigation"
              title="Exit"
              onClick={endNavigation}
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      </header>

      <div className="pointer-events-none flex-1" aria-hidden />

      <footer className="pointer-events-none flex shrink-0 flex-col items-center gap-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
        {(speedLabel || limitLabel) && (
          <div
            className="pointer-events-none flex items-center gap-3 rounded-full border border-[var(--mx-border)] bg-[var(--mx-surface)] px-4 py-2 shadow-[var(--mx-shadow-soft)]"
            aria-live="polite"
          >
            <Gauge size={16} className="text-[var(--mx-accent)]" aria-hidden />
            {speedLabel ? (
              <span className="text-sm font-semibold tabular-nums text-[var(--mx-text)]">
                {speedLabel}
              </span>
            ) : null}
            {limitLabel ? (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-[var(--mx-text)] text-xs font-bold tabular-nums"
                title="Posted speed limit"
                aria-label={`Speed limit ${limitLabel}`}
              >
                {limitLabel}
              </span>
            ) : null}
          </div>
        )}
        <div className="rounded-full border border-[var(--mx-border)] bg-[var(--mx-surface)] px-4 py-2 text-center shadow-[var(--mx-shadow-soft)]">
          <p className="text-sm font-semibold text-[var(--mx-text)]">
            Arrive by {arrivalLabel}
            {trafficLabel ? (
              <span className="ml-1 text-[var(--mx-warning,#d97706)]">
                ({trafficLabel})
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-[var(--mx-text-muted)]">
            {overview ? "Overview" : "Following"} · {distanceLabel} remaining ·{" "}
            {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
          </p>
        </div>
        <Button
          className="pointer-events-auto"
          variant="secondary"
          size="sm"
          onClick={endNavigation}
        >
          Exit navigation
        </Button>
      </footer>
    </div>
  );
}
