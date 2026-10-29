"use client";

import {
  Compass,
  Layers,
  MapPinned,
  Moon,
  Route,
  Search,
  Sun,
  User,
  Flag,
} from "lucide-react";
import { MagnexisLogo, Button } from "@magnexis/ui";
import { useAppStore, type SidebarPanel } from "@/lib/store";

const NAV: { id: SidebarPanel; label: string; icon: typeof Search }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "directions", label: "Directions", icon: Route },
  { id: "saved", label: "Saved", icon: MapPinned },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "community", label: "Community", icon: Flag },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "account", label: "Account", icon: User },
];

export function TopNav() {
  const { panel, setPanel, theme, setTheme, apiHealthy } = useAppStore();

  return (
    <header className="z-20 flex h-16 items-center gap-4 border-b border-[var(--mx-border)] bg-[var(--mx-surface)]/90 px-4 backdrop-blur-xl">
      <MagnexisLogo />
      <nav className="mx-auto hidden items-center gap-1 md:flex">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
              panel === id
                ? "bg-primary/15 text-primary"
                : "text-[var(--mx-text-muted)] hover:bg-[var(--mx-surface-muted)] hover:text-[var(--mx-text)]"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <span
          className={`hidden rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wider sm:inline ${
            apiHealthy === true
              ? "bg-emerald-500/15 text-emerald-400"
              : apiHealthy === false
                ? "bg-red-500/15 text-red-400"
                : "bg-[var(--mx-surface-muted)] text-[var(--mx-text-muted)]"
          }`}
        >
          API {apiHealthy === true ? "online" : apiHealthy === false ? "offline" : "…"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
      </div>
    </header>
  );
}
