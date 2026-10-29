import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "secondary" | "glass";
  size?: "sm" | "md" | "lg" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-[var(--mx-duration)] ease-[var(--mx-ease)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mx-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mx-bg)]",
        "disabled:pointer-events-none disabled:opacity-45",
        "active:scale-[0.98]",
        variant === "primary" &&
          "bg-[var(--mx-accent)] text-white shadow-[0_8px_24px_rgba(49,136,255,0.35)] hover:brightness-110",
        variant === "secondary" &&
          "bg-[var(--mx-surface-2)] text-[var(--mx-text)] hover:bg-[var(--mx-border-strong)]",
        variant === "ghost" &&
          "bg-transparent text-[var(--mx-text-muted)] hover:bg-[var(--mx-surface-2)] hover:text-[var(--mx-text)]",
        variant === "glass" &&
          "border border-[var(--mx-border)] bg-[var(--mx-control)] text-[var(--mx-text)] shadow-[var(--mx-shadow-soft)] backdrop-blur-xl hover:border-[var(--mx-border-strong)]",
        variant === "danger" &&
          "bg-[var(--mx-danger)] text-white hover:brightness-110",
        size === "sm" && "h-9 rounded-[var(--mx-radius-sm)] px-3 text-sm",
        size === "md" && "h-10 rounded-[var(--mx-radius)] px-4 text-sm",
        size === "lg" && "h-12 rounded-[var(--mx-radius)] px-5 text-base",
        size === "icon" && "h-10 w-10 rounded-[var(--mx-radius)] p-0",
        className,
      )}
      {...props}
    />
  );
}
