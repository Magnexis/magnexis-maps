"use client";

import { useState } from "react";
import { clsx } from "clsx";

type Props = {
  className?: string;
  showWordmark?: boolean;
  size?: number;
  /** Public path or absolute URL to the official logo PNG */
  src?: string;
};

/** Minimal SVG fallback matching the official mark colors (PNG preferred). */
function LogoSvgFallback({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0 rounded-full"
    >
      <rect width="64" height="64" rx="32" fill="#262626" />
      <circle cx="32" cy="32" r="24" stroke="#9C6B43" strokeWidth="3" fill="none" />
      <circle cx="32" cy="32" r="18" stroke="#9C6B43" strokeWidth="1.5" fill="none" />
      <path
        d="M18 44 V20 L32 38 L46 20 V44"
        stroke="#74C2FF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Official Magnexis Maps mark — blue M in bronze compass ring on charcoal.
 * Prefers the official PNG; falls back to a simple SVG if the image fails to load.
 */
export function MagnexisLogo({
  className,
  showWordmark = true,
  size = 40,
  src = "/logo.png",
}: Props) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      {failed ? (
        <LogoSvgFallback size={size} />
      ) : (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="shrink-0 rounded-full object-cover shadow-[0_0_0_1px_rgba(156,107,67,0.4)]"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
      {showWordmark ? (
        <div className="leading-[1.05]">
          <div className="font-display text-[13px] font-semibold tracking-[0.2em] text-[var(--mx-text)]">
            MAGNEXIS
          </div>
          <div className="text-[10px] font-semibold tracking-[0.38em] text-[var(--mx-accent)]">
            MAPS
          </div>
        </div>
      ) : null}
    </div>
  );
}
