"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

/** Polished selectable row for Layers / map appearance (replaces dotted radios). */
export function MapChoiceRow({
  selected,
  disabled,
  onSelect,
  title,
  description,
  multi = false,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Checkbox-style (multi) vs radio-style (single). */
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        selected
          ? "border-[var(--mx-accent)] bg-[color-mix(in_srgb,var(--mx-accent)_12%,transparent)]"
          : "border-[var(--mx-border)] bg-[var(--mx-surface-2)]/40 hover:border-[var(--mx-border-strong)] hover:bg-[var(--mx-surface-muted)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition ${
          multi ? "rounded-md" : "rounded-full"
        } ${
          selected
            ? "border-[var(--mx-accent)] bg-[var(--mx-accent)] text-white"
            : "border-[var(--mx-border-strong)] bg-[var(--mx-surface)] text-transparent"
        }`}
        aria-hidden
      >
        <Check size={12} strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--mx-text)]">
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[11px] text-[var(--mx-text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
