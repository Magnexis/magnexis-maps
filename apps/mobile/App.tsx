import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { createApiClient } from "@magnexis/api-client";
import type { Coordinates, Hotspot, Route, SearchResult, TravelMode } from "@magnexis/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
type Tab = "explore" | "directions" | "saved" | "you";

function distance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

function duration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
}

/** Expo Go companion sharing Magnexis API contracts with the web/iPhone app. */
export default function App() {
  const [tab, setTab] = useState<Tab>("explore");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [destination, setDestination] = useState<SearchResult | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationLabel, setLocationLabel] = useState("Location off");
  const [status, setStatus] = useState("Checking API…");
  const [searching, setSearching] = useState(false);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [mode, setMode] = useState<TravelMode>("driving");
  const api = useMemo(() => createApiClient({ baseUrl: API_URL }), []);
  const route = routes[selectedRoute] ?? null;

  useEffect(() => {
    void api.health().then((health) => setStatus(`API ${health.status} · v${health.version}`)).catch(() => setStatus("API offline — use a reachable HTTPS or LAN API URL for device testing"));
  }, [api]);

  async function useLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setLocationLabel("Permission denied — search and directions still work");
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({});
      const coordinates = { lng: position.coords.longitude, lat: position.coords.latitude };
      setLocation(coordinates);
      setLocationLabel(`${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`);
      try {
        const response = await api.hotspots({ ...coordinates, radiusMeters: 8_000, limit: 8 });
        setHotspots(response.hotspots);
      } catch {
        setHotspots([]);
      }
    } catch {
      setLocationLabel("Couldn’t determine location — check Location Services");
    }
  }

  async function search() {
    const term = query.trim();
    if (term.length < 2) return setStatus("Enter at least two characters to search");
    setSearching(true);
    try {
      const response = await api.search({ q: term, lng: location?.lng, lat: location?.lat, limit: 15 });
      setResults(response.results);
      setStatus(response.results.length ? `${response.results.length} places found` : "No places found");
    } catch {
      setResults([]);
      setStatus("Search failed — is the API reachable from this device?");
    } finally {
      setSearching(false);
    }
  }

  function chooseDestination(place: SearchResult) {
    setDestination(place);
    setRoutes([]);
    setSelectedRoute(0);
    setRouteError(null);
    setTab("directions");
  }

  async function planRoute() {
    if (!destination?.coordinates) return setRouteError("Choose a destination from Explore first.");
    if (!location) return setRouteError("Enable location to use your current position as the route origin.");
    setRouting(true);
    setRouteError(null);
    try {
      const response = await api.createRoute({
        origin: location,
        destination: destination.coordinates,
        mode,
        alternatives: true,
        avoidHighways: false,
        avoidTolls: false,
        avoidFerries: false,
        routePreference: "fastest",
      });
      setRoutes(response.routes);
      setSelectedRoute(0);
      if (!response.routes.length) setRouteError("No route is available for this trip.");
    } catch {
      setRoutes([]);
      setRouteError("Couldn’t plan this route. Check the routing service and try again.");
    } finally {
      setRouting(false);
    }
  }

  return <SafeAreaView style={styles.root}>
    <StatusBar barStyle="light-content" />
    <View style={styles.header}>
      <Image source={require("./assets/icon.png")} style={styles.logo} accessibilityLabel="Magnexis Maps" />
      <View><Text style={styles.brand}>MAGNEXIS</Text><Text style={styles.brandSub}>MAPS · HORIZON</Text></View>
    </View>
    <Text style={styles.meta}>{status}</Text>
    <Text style={styles.meta}>GPS: {locationLabel}</Text>

    {tab === "explore" ? <View style={styles.body}>
      <Pressable style={styles.secondaryButton} onPress={() => void useLocation()}><Text style={styles.secondaryText}>{location ? "Refresh location" : "Enable location"}</Text></Pressable>
      <View style={styles.searchRow}>
        <TextInput style={styles.input} placeholder="Search places…" placeholderTextColor="#9EACC0" value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} returnKeyType="search" accessibilityLabel="Search places" />
        <Pressable style={styles.button} disabled={searching} onPress={() => void search()}><Text style={styles.buttonText}>{searching ? "…" : "Go"}</Text></Pressable>
      </View>
      <FlatList data={results} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" ListHeaderComponent={hotspots.length ? <View style={styles.hotspotSection}><Text style={styles.sectionTitle}>Hotspots nearby</Text><Text style={styles.meta}>Recent-activity estimate from public place density — not live foot traffic.</Text>{hotspots.map((hotspot) => <View key={hotspot.id} style={styles.hotspot}><View style={styles.hotspotDot} /><View><Text style={styles.cardTitle}>{hotspot.label}</Text><Text style={styles.meta}>Activity estimate {hotspot.activityScore}/100</Text></View></View>)}</View> : null} renderItem={({ item }) => <Pressable style={styles.card} onPress={() => chooseDestination(item)} accessibilityLabel={`Directions to ${item.label}`}><Text style={styles.cardTitle}>{item.label}</Text><Text style={styles.meta}>{item.address ?? `${item.coordinates.lat.toFixed(4)}, ${item.coordinates.lng.toFixed(4)}`} · {item.source}</Text><Text style={styles.action}>Directions</Text></Pressable>} ListEmptyComponent={<Text style={styles.meta}>Search a place, select it, then plan a driving, walking, or cycling route. The bundled iPhone app uses the complete shared Horizon interface.</Text>} />
    </View> : null}

    {tab === "directions" ? <View style={styles.body}>
      <Text style={styles.cardTitle}>Directions</Text><Text style={styles.meta}>{destination ? `To ${destination.label}` : "Choose a destination from Explore."}</Text>
      <View style={styles.modeRow}>{(["driving", "walking", "cycling"] as const).map((travelMode) => <Pressable key={travelMode} style={[styles.mode, mode === travelMode && styles.modeActive]} onPress={() => setMode(travelMode)}><Text style={[styles.modeText, mode === travelMode && styles.modeTextActive]}>{travelMode === "driving" ? "Drive" : travelMode === "walking" ? "Walk" : "Bike"}</Text></Pressable>)}</View>
      {!location ? <Pressable style={styles.secondaryButton} onPress={() => void useLocation()}><Text style={styles.secondaryText}>Use my location as origin</Text></Pressable> : null}
      <Pressable style={styles.buttonWide} disabled={routing || !destination} onPress={() => void planRoute()}><Text style={styles.buttonText}>{routing ? "Planning route…" : "Get route"}</Text></Pressable>
      {routeError ? <Text style={styles.error}>{routeError}</Text> : null}
      {routes.length > 1 ? <View style={styles.alternatives}>{routes.map((candidate, index) => <Pressable key={candidate.id} style={[styles.routeChoice, index === selectedRoute && styles.routeChoiceActive]} onPress={() => setSelectedRoute(index)}><Text style={styles.cardTitle}>{duration(candidate.durationSeconds)}</Text><Text style={styles.meta}>{distance(candidate.distanceMeters)} · {candidate.trafficAware ? "traffic-aware" : candidate.provider}</Text></Pressable>)}</View> : null}
      {route ? <View style={styles.routeSummary}><Text style={styles.routeHeadline}>{duration(route.durationSeconds)} · {distance(route.distanceMeters)}</Text><Text style={styles.meta}>{route.summary ?? `${route.maneuvers.length} steps · ${route.provider}`}</Text><Text style={styles.meta}>Turn-by-turn display, background guidance, and offline routes remain unavailable in Expo Go.</Text></View> : null}
    </View> : null}

    {tab === "saved" ? <View style={styles.body}><Text style={styles.cardTitle}>Saved</Text><Text style={styles.meta}>Account-backed saves are available in the shared web and iPhone product. This Expo companion does not claim local or synced saves until secure device storage and OAuth are configured.</Text></View> : null}
    {tab === "you" ? <View style={styles.body}><Text style={styles.cardTitle}>You</Text><Text style={styles.meta}>Account and community tools use the shared web/iPhone product today. Platform: {Platform.OS}</Text></View> : null}

    <View style={styles.tabBar}>{([ ["explore", "Explore"], ["directions", "Go"], ["saved", "Saved"], ["you", "You"] ] as const).map(([id, label]) => <Pressable key={id} style={styles.tab} onPress={() => setTab(id)}><Text style={[styles.tabText, tab === id && styles.tabActive]}>{label}</Text></Pressable>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#07111F", paddingHorizontal: 16 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }, logo: { width: 44, height: 44, borderRadius: 22 }, brand: { color: "#F7FAFF", fontSize: 16, letterSpacing: 4, fontWeight: "700" }, brandSub: { color: "#3188FF", fontSize: 10, letterSpacing: 3, fontWeight: "600" }, meta: { color: "#9EACC0", marginBottom: 8, marginTop: 4, lineHeight: 18 }, body: { flex: 1, paddingTop: 8 }, searchRow: { flexDirection: "row", gap: 8, marginVertical: 12 }, input: { flex: 1, backgroundColor: "#101D2D", color: "#F7FAFF", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 }, button: { backgroundColor: "#3188FF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignSelf: "flex-start" }, buttonWide: { backgroundColor: "#3188FF", borderRadius: 14, padding: 14, alignItems: "center", marginTop: 12 }, buttonText: { color: "#fff", fontWeight: "700" }, secondaryButton: { borderColor: "#37516D", borderWidth: 1, borderRadius: 12, padding: 11, alignSelf: "flex-start", marginTop: 4 }, secondaryText: { color: "#D9E8FC", fontWeight: "600" }, card: { backgroundColor: "#101D2D", borderRadius: 14, padding: 14, marginBottom: 8 }, cardTitle: { color: "#F7FAFF", fontWeight: "600", fontSize: 16 }, action: { color: "#68A7FF", fontWeight: "700", marginTop: 4 }, hotspotSection: { marginBottom: 14 }, sectionTitle: { color: "#F7FAFF", fontSize: 18, fontWeight: "700", marginTop: 4 }, hotspot: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#20151B", borderRadius: 14, padding: 12, marginTop: 7, borderWidth: 1, borderColor: "#64313A" }, hotspotDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#E54747", borderWidth: 2, borderColor: "#FFD8D8" }, modeRow: { flexDirection: "row", gap: 8, marginTop: 12 }, mode: { borderWidth: 1, borderColor: "#37516D", borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13 }, modeActive: { borderColor: "#3188FF", backgroundColor: "#163A68" }, modeText: { color: "#9EACC0", fontWeight: "600" }, modeTextActive: { color: "#F7FAFF" }, alternatives: { gap: 8, marginTop: 12 }, routeChoice: { borderWidth: 1, borderColor: "#243347", borderRadius: 12, padding: 12 }, routeChoiceActive: { borderColor: "#3188FF", backgroundColor: "#101D2D" }, routeSummary: { backgroundColor: "#101D2D", borderRadius: 14, padding: 14, marginTop: 12 }, routeHeadline: { color: "#F7FAFF", fontSize: 18, fontWeight: "700" }, error: { color: "#FCA5A5", marginTop: 12, lineHeight: 18 }, tabBar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#243347", paddingVertical: 10, marginBottom: 4 }, tab: { flex: 1, alignItems: "center" }, tabText: { color: "#9EACC0", fontSize: 12, fontWeight: "600" }, tabActive: { color: "#3188FF" },
});
