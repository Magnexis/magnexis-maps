import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-[var(--mx-radius-lg)] border border-[var(--mx-border)]",
        "bg-[var(--mx-surface-glass)] shadow-[var(--mx-shadow-float)] backdrop-blur-[var(--mx-blur)]",
        className,
      )}
      {...props}
    />
  );
}
