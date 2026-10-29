"use client";

import { getGeolocation, geolocationFailureMessage } from "@/lib/geolocation";

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Box,
  Compass,
  Flag,
  Layers,
  LocateFixed,
  MapPinned,
  Moon,
  Navigation2,
  Route,
  Search,
  Sun,
  TrafficCone,
  User,
  X,
  Minus,
  Plus,
} from "lucide-react";
import { MagnexisLogo, Button, Input, Panel } from "@magnexis/ui";
import {
  getActiveRoute,
  useAppStore,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  type SidebarPanel,
} from "@/lib/store";
import { useStartNavigation } from "@/hooks/use-start-navigation";
import {
  formatArrivalTime,
  formatDurationSeconds,
  formatTrafficDelay,
} from "@/lib/format";
import { SearchPanel } from "@/components/panels/search-panel";
import { DirectionsPanel } from "@/components/panels/directions-panel";
import { LayersPanel } from "@/components/panels/layers-panel";
import { ReportPanel } from "@/components/panels/report-panel";
import { CommunityPanel } from "@/components/panels/community-panel";
import { AccountPanel } from "@/components/panels/account-panel";
import { SavedPanel } from "@/components/panels/saved-panel";
import { ExplorePanel } from "@/components/panels/explore-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import { SelectedPlaceCard } from "@/components/places/selected-place-card";
import { TrafficLegend } from "@/components/map/traffic-legend";
import { startDirectionsTo } from "@/lib/place-actions";
import { getMap } from "@/lib/map-registry";
import { useLiveMapCamera } from "@/hooks/use-live-map-camera";
import { trafficConfigured } from "@/lib/traffic";

/**
 * Primary destinations — same on phone, tablet, desktop (and Tauri).
 * Layout reflows; screens/flows do not fork by platform.
 */
const QUICK: { id: SidebarPanel; label: string; icon: typeof Search }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "directions", label: "Go", icon: Route },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "saved", label: "Saved", icon: MapPinned },
];

const PANEL_TITLE: Record<SidebarPanel, string> = {
  search: "Search",
  directions: "Directions",
  saved: "Saved places",
  explore: "Explore nearby",
  community: "Community",
  layers: "Map appearance",
  report: "Suggest an edit",
  account: "Account",
  settings: "Settings",
};

export function HorizonChrome() {
  const {
    panel,
    setPanel,
    sheetCollapsed,
    setSheetCollapsed,
    panelWidthPx,
    setPanelWidthPx,
    openPanel,
    theme,
    setTheme,
    apiHealthy,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    setSelectedPlace,
    setSelectedSearch,
    selectedPlace,
    selectedSearch,
    pushRecentSearch,
    mapView,
    setMapView,
    setUserLocation,
    directions,
    settings,
    patchSettings,
    toggleLayer,
    layers,
  } = useAppStore();
  const startNavigation = useStartNavigation();
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const liveCamera = useLiveMapCamera();
  const buildings3d = Boolean(settings.buildings3d);
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsOpen = panel === "settings" && !sheetCollapsed;
  const sheetOpen = !sheetCollapsed && !settingsOpen;
  const activeRoute = getActiveRoute(directions);
  const showPlacePeek =
    sheetCollapsed &&
    Boolean(selectedPlace || selectedSearch) &&
    selectedSearch?.source !== "user_submission";

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedPlace(null);
    setSelectedSearch(null);
  }

  const openSettings = () => openPanel("settings");

  const closePanel = () => setSheetCollapsed(true);

  const onPanelResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = panelWidthPx;
      const onMove = (ev: PointerEvent) => {
        setPanelWidthPx(startW + (ev.clientX - startX));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [panelWidthPx, setPanelWidthPx],
  );

  const openScreen = (id: SidebarPanel) => {
    if (panel === id && !sheetCollapsed) {
      setSheetCollapsed(true);
      return;
    }
    openPanel(id);
  };

  const panelBody = (
    <>
      {panel === "search" && <SearchPanel hideHeader />}
      {panel === "directions" && <DirectionsPanel hideHeader />}
      {panel === "layers" && <LayersPanel hideHeader />}
      {panel === "report" && <ReportPanel hideHeader />}
      {panel === "community" && <CommunityPanel hideHeader />}
      {panel === "account" && <AccountPanel hideHeader />}
      {panel === "saved" && <SavedPanel hideHeader />}
      {panel === "explore" && <ExplorePanel hideHeader />}
    </>
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPanel("search");
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        const s = useAppStore.getState();
        if (!s.sheetCollapsed) {
          setSheetCollapsed(true);
        } else if (s.selectedPlace || s.selectedSearch) {
          s.setSelectedPlace(null);
          s.setSelectedSearch(null);
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "l") {
        e.preventDefault();
        openPanel("layers");
      } else if (key === "g" || key === "d") {
        e.preventDefault();
        openPanel("directions");
      } else if (key === "n") {
        e.preventDefault();
        setMapView({ bearing: 0, pitch: 0 });
        const map = getMap();
        if (!map) return;
        map.stop();
        if (typeof map.resetNorthPitch === "function") {
          map.resetNorthPitch({ duration: 420, essential: true });
        } else {
          map.easeTo({ bearing: 0, pitch: 0, duration: 420, essential: true });
        }
      } else if (key === "t" && trafficConfigured()) {
        e.preventDefault();
        toggleLayer("traffic");
      } else if (key === "/") {
        e.preventDefault();
        openPanel("search");
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel, setSheetCollapsed, setMapView, toggleLayer]);

  return (
    <>
      {/* Top bar — same structure all breakpoints; respects notch / status bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-2 pb-2 pt-[max(0.5rem,var(--mx-safe-t))] sm:px-3 sm:pb-3 sm:pt-[max(0.75rem,var(--mx-safe-t))] md:px-4 md:pb-4 lg:px-5">
        <div className="pointer-events-auto mx-auto flex w-full min-w-0 max-w-[1600px] items-center gap-1.5 sm:gap-2 md:gap-3">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mx-ring)] sm:h-auto sm:w-auto"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            aria-controls="mx-settings-drawer"
            onClick={openSettings}
          >
            <MagnexisLogo
              size={36}
              className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] [&>div]:hidden sm:[&>div]:block"
            />
          </button>

          <Panel className="flex min-w-0 flex-1 items-center gap-1.5 !rounded-full px-2.5 py-1 sm:gap-2 sm:px-3.5 sm:py-1.5 md:max-w-2xl lg:max-w-3xl">
            <Search
              size={18}
              className="ml-0.5 shrink-0 text-[var(--mx-text-muted)] sm:ml-1"
            />
            <Input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                openPanel("search");
              }}
              onFocus={() => {
                openPanel("search");
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const top = searchResults[0];
                if (top?.coordinates) {
                  pushRecentSearch(top.label);
                  startDirectionsTo(top);
                  return;
                }
                openPanel("search");
              }}
              placeholder="Search places — Enter for directions"
              className="h-10 min-w-0 flex-1 !rounded-full border-0 bg-transparent px-1.5 text-base shadow-none focus:!border-transparent focus:!ring-0 sm:h-10 sm:px-2 sm:text-sm md:placeholder:tracking-normal"
              aria-label="Universal search"
            />
            {searchQuery.trim() ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0 sm:h-9 sm:w-9"
                aria-label="Clear search"
                onClick={clearSearch}
              >
                <X size={14} />
              </Button>
            ) : (
              <kbd className="mr-0.5 hidden shrink-0 rounded-full border border-[var(--mx-border)] px-1.5 py-0.5 text-[10px] text-[var(--mx-text-muted)] md:inline">
                ⌘K
              </kbd>
            )}
          </Panel>

          <Panel className="flex shrink-0 items-center gap-0.5 p-1 sm:gap-1 sm:p-1.5">
            <span
              className={`mx-0.5 hidden h-2 w-2 rounded-full md:inline ${
                apiHealthy === true
                  ? "bg-[var(--mx-success)]"
                  : apiHealthy === false
                    ? "bg-[var(--mx-danger)]"
                    : "bg-[var(--mx-text-muted)]"
              }`}
              title={
                apiHealthy === true
                  ? "API online"
                  : apiHealthy === false
                    ? "API offline"
                    : "Checking API"
              }
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 sm:h-10 sm:w-10"
              aria-label="Map appearance"
              onClick={() => openScreen("layers")}
            >
              <Layers size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 sm:h-10 sm:w-10"
              aria-label="Account"
              onClick={() => openScreen("account")}
            >
              <User size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 sm:h-10 sm:w-10"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </Panel>
        </div>
      </div>

      {/* Settings drawer — kept mounted for slide open/close */}
      <div
        className="pointer-events-none absolute inset-0 z-30"
        aria-hidden={!settingsOpen}
        inert={!settingsOpen ? true : undefined}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-[color-mix(in_srgb,var(--mx-bg)_55%,transparent)] backdrop-blur-[2px] mx-scrim ${
            settingsOpen ? "mx-scrim-open" : ""
          }`}
          aria-label="Close settings"
          tabIndex={settingsOpen ? 0 : -1}
          onClick={closePanel}
        />
        <aside
          id="mx-settings-drawer"
          role="dialog"
          aria-modal={settingsOpen}
          aria-labelledby="mx-settings-title"
          aria-hidden={!settingsOpen}
          className={`absolute inset-y-0 left-0 flex w-[min(100%,22rem)] flex-col border-r border-[var(--mx-border)] bg-[var(--mx-surface)] pt-[var(--mx-safe-t)] shadow-[var(--mx-shadow-float)] mx-drawer sm:w-[min(100%,24rem)] md:w-[min(100%,26rem)] lg:w-[min(100%,28rem)] ${
            settingsOpen
              ? "mx-drawer-open pointer-events-auto"
              : "pointer-events-none"
          }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--mx-border)] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2
                id="mx-settings-title"
                className="font-display text-base font-semibold tracking-tight"
              >
                Settings
              </h2>
              <p className="text-xs text-[var(--mx-text-muted)]">
                Magnexis Horizon · v1.4.0
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              aria-label="Close settings"
              className="shrink-0 gap-1.5"
              onClick={closePanel}
            >
              <X size={14} />
              <span>Close</span>
            </Button>
          </div>
          <div className="mx-scroll min-h-0 flex-1 overflow-y-auto p-4">
            <SettingsPanel />
          </div>
        </aside>
      </div>

      {/*
        Unified content screen — kept mounted for slide open/close.
        Phone: nearly full frame above the dock (+ safe area).
        Desktop: left column capped width; same header + body.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[var(--mx-top-stack)] z-[25]"
        aria-hidden={!sheetOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-[color-mix(in_srgb,var(--mx-bg)_35%,transparent)] mx-scrim md:bg-transparent ${
            sheetOpen ? "mx-scrim-open md:pointer-events-none" : ""
          }`}
          aria-label="Close screen"
          tabIndex={sheetOpen ? 0 : -1}
          onClick={closePanel}
        />
        <section
          role="dialog"
          aria-modal={sheetOpen}
          aria-label={PANEL_TITLE[panel]}
          className={`absolute inset-x-0 bottom-[var(--mx-dock-stack)] top-0 flex flex-col px-2 sm:px-3 md:inset-x-auto md:left-4 md:top-0 md:px-0 lg:left-5 xl:left-6 mx-sheet ${
            sheetOpen ? "mx-sheet-open" : ""
          }`}
          style={
            {
              ["--mx-panel-width" as string]: `${panelWidthPx}px`,
            } as CSSProperties
          }
        >
          <Panel className="relative flex min-h-0 flex-1 flex-col overflow-hidden !rounded-2xl bg-[var(--mx-surface)] shadow-[var(--mx-shadow-float)] md:!rounded-[1.25rem] md:w-[min(100%-2rem,var(--mx-panel-width,var(--mx-panel-max,22rem)))] lg:w-[min(100%-2.5rem,var(--mx-panel-width,26rem))] xl:w-[min(100%-3rem,var(--mx-panel-width,28rem))]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--mx-border)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold tracking-tight md:text-[1.05rem]">
                  {PANEL_TITLE[panel]}
                </h2>
                <p className="text-xs text-[var(--mx-text-muted)]">
                  {QUICK.find((q) => q.id === panel)?.label ?? "Magnexis Maps"}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Close screen"
                className="min-h-10 shrink-0 gap-1.5 px-3"
                onClick={closePanel}
              >
                <X size={14} />
                <span>Close</span>
              </Button>
            </div>
            <div className="mx-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {panelBody}
            </div>
            {/* Desktop/tablet map+list split resize handle */}
            <button
              type="button"
              className="absolute inset-y-3 right-0 z-10 hidden w-2 cursor-col-resize touch-none rounded-full md:block"
              aria-label="Resize panel"
              title={`Drag to resize (${PANEL_WIDTH_MIN}–${PANEL_WIDTH_MAX}px)`}
              onPointerDown={onPanelResizeStart}
            >
              <span className="absolute inset-y-8 right-0.5 w-1 rounded-full bg-[var(--mx-border)] opacity-70 hover:bg-[var(--mx-accent)] hover:opacity-100" />
            </button>
          </Panel>
        </section>
      </div>

      {/* Map utilities — same controls all sizes; 44px targets on phone */}
      <div
        className="pointer-events-none absolute bottom-[var(--mx-fab-stack)] z-20 flex flex-col gap-2"
        style={{
          right: "max(0.75rem, var(--mx-safe-r))",
        }}
      >
        <div className="pointer-events-auto flex flex-col gap-2 sm:gap-2.5">
          <Button
            size="icon"
            variant="glass"
            className="h-11 w-11 sm:h-10 sm:w-10"
            aria-label="Zoom in"
            onClick={() => {
              const map = getMap();
              if (map) map.zoomIn({ duration: 280 });
              else setMapView({ zoom: mapView.zoom + 1 });
            }}
          >
            <Plus size={16} />
          </Button>
          <Button
            size="icon"
            variant="glass"
            className="h-11 w-11 sm:h-10 sm:w-10"
            aria-label="Zoom out"
            onClick={() => {
              const map = getMap();
              if (map) map.zoomOut({ duration: 280 });
              else setMapView({ zoom: Math.max(1, mapView.zoom - 1) });
            }}
          >
            <Minus size={16} />
          </Button>
          <Button
            size="icon"
            variant="glass"
            className="h-11 w-11 sm:h-10 sm:w-10"
            aria-label="Reset map to north"
            title={
              Math.abs(liveCamera.bearing) > 1 || liveCamera.pitch > 2
                ? "Compass — tap to reset north & tilt (N)"
                : "Facing north — rotate the map to reorient"
            }
            onClick={() => {
              // Update store immediately so the store→map sync effect aims at
              // north/flat. Animate MapLibre directly — do NOT attach moveend
              // after map.stop(); stop()'s moveend can steal that listener and
              // write the pre-reset camera back into the store (reset no-op).
              setMapView({ bearing: 0, pitch: 0 });
              const map = getMap();
              if (!map) return;
              map.stop();
              if (typeof map.resetNorthPitch === "function") {
                map.resetNorthPitch({ duration: 420, essential: true });
              } else {
                map.easeTo({
                  bearing: 0,
                  pitch: 0,
                  duration: 420,
                  essential: true,
                });
              }
            }}
            style={{
              opacity:
                Math.abs(liveCamera.bearing) > 1 || liveCamera.pitch > 2
                  ? 1
                  : 0.55,
            }}
          >
            <Compass
              size={16}
              style={{ transform: `rotate(${-liveCamera.bearing}deg)` }}
            />
          </Button>
          <Button
            size="icon"
            variant="glass"
            className="h-11 w-11 sm:h-10 sm:w-10"
            aria-label="Locate me"
            aria-busy={locationPending}
            disabled={locationPending}
            title="Show your current location"
            onClick={() => {
              setLocationError(null);
              if (!getGeolocation()) {
                setLocationError(geolocationFailureMessage(2));
                return;
              }
              setLocationPending(true);
              getGeolocation()?.getCurrentPosition(
                (pos) => {
                  setLocationPending(false);
                  const loc = {
                    lng: pos.coords.longitude,
                    lat: pos.coords.latitude,
                    accuracy: pos.coords.accuracy,
                  };
                  setUserLocation(loc);
                  setMapView({ center: loc, zoom: Math.max(mapView.zoom, 15) });
                  getMap()?.flyTo({
                    center: [loc.lng, loc.lat],
                    zoom: Math.max(mapView.zoom, 15),
                    essential: true,
                  });
                },
                (error) => {
                  setLocationPending(false);
                  setLocationError(geolocationFailureMessage(error.code));
                },
                { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 },
              );
            }}
          >
            <LocateFixed size={16} />
          </Button>
          <Button
            size="icon"
            variant={buildings3d ? "primary" : "glass"}
            className="h-11 w-11 sm:h-10 sm:w-10"
            aria-label={
              buildings3d ? "Turn off 3D buildings" : "Turn on 3D buildings"
            }
            aria-pressed={buildings3d}
            title={
              buildings3d
                ? "3D on — tap to flatten buildings"
                : "3D buildings — extrude city blocks & tilt (like Maps)"
            }
            onClick={() => patchSettings({ buildings3d: !buildings3d })}
            style={buildings3d ? undefined : { opacity: 0.85 }}
          >
            <Box size={16} />
          </Button>
          {trafficConfigured() ? (
            <Button
              size="icon"
              variant={layers.traffic ? "primary" : "glass"}
              className="h-11 w-11 sm:h-10 sm:w-10"
              aria-label={
                layers.traffic ? "Hide live traffic" : "Show live traffic"
              }
              aria-pressed={layers.traffic}
              title={
                layers.traffic
                  ? "Traffic on — tap to hide (T)"
                  : "Live traffic congestion (T)"
              }
              onClick={() => toggleLayer("traffic")}
            >
              <TrafficCone size={16} />
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="glass"
            className="h-11 w-11 sm:h-10 sm:w-10"
            aria-label="Map layers and appearance"
            title="Layers & map appearance (L)"
            onClick={() => openScreen("layers")}
          >
            <Layers size={16} />
          </Button>
          <Button
            size="icon"
            variant="glass"
            className="h-11 w-11 sm:h-10 sm:w-10"
            aria-label="Report issue"
            onClick={() => openScreen("report")}
          >
            <Flag size={16} />
          </Button>
          {activeRoute ? (
            <Button
              size="icon"
              variant="primary"
              className="h-11 w-11 sm:h-10 sm:w-10"
              aria-label="Start navigation"
              title="Start turn-by-turn navigation"
              onClick={() => startNavigation()}
            >
              <Navigation2 size={16} />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Primary nav dock — same destinations all breakpoints; thumb-sized targets */}
      <nav
        aria-label="Primary"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pt-1 sm:px-4 md:px-5"
        style={{
          paddingBottom: "calc(0.65rem + var(--mx-safe-b))",
          paddingLeft: "max(0.75rem, var(--mx-safe-l))",
          paddingRight: "max(0.75rem, var(--mx-safe-r))",
        }}
      >
        <Panel
          className="pointer-events-auto mx-auto flex w-full max-w-[20rem] items-center justify-around !rounded-full border-[color-mix(in_srgb,var(--mx-border)_65%,transparent)] px-0.5 py-0.5 shadow-[var(--mx-shadow-soft)] sm:max-w-sm"
          data-mx-shell="unified-dock"
        >
          {QUICK.map(({ id, label, icon: Icon }) => {
            const active = panel === id && !sheetCollapsed;
            return (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] leading-none tracking-wide transition-colors md:hover:bg-[color-mix(in_srgb,var(--mx-surface-2)_80%,transparent)] ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--mx-accent)_18%,transparent)] text-[var(--mx-accent)]"
                    : "text-[var(--mx-text-muted)]"
                }`}
                onClick={() => openScreen(id)}
              >
                <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </Panel>
      </nav>

      {/* Status strip — above dock; desktop tucks left so the map center stays clear */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-3 md:justify-start md:pl-[max(1rem,var(--mx-safe-l))] lg:pl-5"
        style={{ bottom: "var(--mx-status-stack)" }}
      >
        <div className="max-w-[min(100%,20rem)] truncate rounded-full border border-[var(--mx-border)] bg-[var(--mx-surface)]/95 px-3 py-1.5 text-[10px] tabular-nums text-[var(--mx-text-muted)] backdrop-blur-sm sm:max-w-none sm:text-[11px] md:ml-[4.75rem] md:max-w-xs lg:ml-24">
          {activeRoute
            ? `${formatDurationSeconds(activeRoute.durationSeconds)} · arrive ${formatArrivalTime(activeRoute.durationSeconds)}${
                formatTrafficDelay(activeRoute.trafficDelaySeconds)
                  ? ` · ${formatTrafficDelay(activeRoute.trafficDelaySeconds)}`
                  : ""
              }`
            : `${mapView.center.lat.toFixed(5)}, ${mapView.center.lng.toFixed(5)} · z${mapView.zoom.toFixed(1)}`}
        </div>
      </div>

      <TrafficLegend />

      {locationError ? (
        <div
          role="alert"
          className="pointer-events-auto absolute inset-x-3 bottom-[var(--mx-peek-stack)] z-40 mx-auto flex max-w-md items-start gap-3 rounded-xl border border-[var(--mx-border)] bg-[var(--mx-surface)] p-4 text-sm text-[var(--mx-text)] shadow-lg"
        >
          <p className="flex-1">{locationError}</p>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss location message"
            onClick={() => setLocationError(null)}
          >
            <X size={16} />
          </Button>
        </div>
      ) : null}

      {showPlacePeek ? (
        <SelectedPlaceCard place={selectedPlace} search={selectedSearch} />
      ) : null}

      {/* Required data credits — sits left of FAB column, above dock */}
      <p
        className="pointer-events-none absolute z-10 max-w-[42vw] text-right text-[9px] leading-snug text-[var(--mx-text-muted)] opacity-65 sm:max-w-none sm:text-[10px] md:opacity-70"
        style={{
          bottom: "var(--mx-fab-stack)",
          right: "max(3.5rem, calc(var(--mx-safe-r) + 3.25rem))",
        }}
      >
        ©{" "}
        <a
          className="pointer-events-auto underline-offset-2 hover:underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OSM
        </a>
        {" · "}
        <a
          className="pointer-events-auto underline-offset-2 hover:underline"
          href="https://openfreemap.org/"
          target="_blank"
          rel="noreferrer"
        >
          OpenFreeMap
        </a>
        {" · "}
        <a
          className="pointer-events-auto underline-offset-2 hover:underline"
          href="https://www.maptiler.com/"
          target="_blank"
          rel="noreferrer"
        >
          MapTiler
        </a>
        {" · "}
        <a
          className="pointer-events-auto underline-offset-2 hover:underline"
          href="https://www.mapillary.com/"
          target="_blank"
          rel="noreferrer"
        >
          Mapillary
        </a>
      </p>
    </>
  );
}
