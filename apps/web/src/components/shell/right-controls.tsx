"use client";

import { AlertTriangle, LocateFixed, Plus, Minus } from "lucide-react";
import { Button } from "@magnexis/ui";
import { useAppStore } from "@/lib/store";

export function RightControls() {
  const { setPanel, mapView, setMapView, setUserLocation } = useAppStore();

  return (
    <div className="absolute right-4 top-24 z-10 flex flex-col gap-2 md:right-6">
      <Button
        variant="secondary"
        size="sm"
        className="shadow-panel"
        aria-label="Zoom in"
        onClick={() => setMapView({ zoom: mapView.zoom + 1 })}
      >
        <Plus size={16} />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="shadow-panel"
        aria-label="Zoom out"
        onClick={() => setMapView({ zoom: Math.max(1, mapView.zoom - 1) })}
      >
        <Minus size={16} />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="shadow-panel"
        aria-label="Use my location"
        onClick={() => {
          if (!navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setUserLocation({
                lng: pos.coords.longitude,
                lat: pos.coords.latitude,
              });
              setMapView({
                center: {
                  lng: pos.coords.longitude,
                  lat: pos.coords.latitude,
                },
                zoom: 14,
              });
            },
            () => {
              // permission denied — silent; GeolocateControl also available
            },
            { enableHighAccuracy: true },
          );
        }}
      >
        <LocateFixed size={16} />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="shadow-panel"
        onClick={() => setPanel("report")}
      >
        <AlertTriangle size={16} />
        Report
      </Button>
    </div>
  );
}
