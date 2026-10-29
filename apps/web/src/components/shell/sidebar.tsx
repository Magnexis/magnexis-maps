"use client";

import { useAppStore } from "@/lib/store";
import { Panel } from "@magnexis/ui";
import { SearchPanel } from "@/components/panels/search-panel";
import { DirectionsPanel } from "@/components/panels/directions-panel";
import { LayersPanel } from "@/components/panels/layers-panel";
import { ReportPanel } from "@/components/panels/report-panel";
import { CommunityPanel } from "@/components/panels/community-panel";
import { AccountPanel } from "@/components/panels/account-panel";
import { SavedPanel } from "@/components/panels/saved-panel";
import { ExplorePanel } from "@/components/panels/explore-panel";

export function Sidebar() {
  const panel = useAppStore((s) => s.panel);

  return (
    <aside className="pointer-events-none absolute bottom-4 left-4 top-20 z-10 w-[min(100%-2rem,380px)] md:bottom-6 md:left-6">
      <Panel className="pointer-events-auto flex h-full max-h-[calc(100vh-6rem)] flex-col overflow-hidden">
        <div className="mx-scroll flex-1 overflow-y-auto p-4">
          {panel === "search" && <SearchPanel />}
          {panel === "directions" && <DirectionsPanel />}
          {panel === "layers" && <LayersPanel />}
          {panel === "report" && <ReportPanel />}
          {panel === "community" && <CommunityPanel />}
          {panel === "account" && <AccountPanel />}
          {panel === "saved" && <SavedPanel />}
          {panel === "explore" && <ExplorePanel />}
        </div>
      </Panel>
    </aside>
  );
}
