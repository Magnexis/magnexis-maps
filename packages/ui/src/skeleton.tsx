import { clsx } from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-[var(--mx-radius-sm)] bg-[var(--mx-surface-2)]",
        className,
      )}
    />
  );
}
