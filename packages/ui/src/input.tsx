import { clsx } from "clsx";
import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(
        "h-11 w-full rounded-[var(--mx-radius)] border border-[var(--mx-border)]",
        "bg-[var(--mx-surface-2)] px-3.5 text-sm text-[var(--mx-text)]",
        "placeholder:text-[var(--mx-text-muted)]",
        "outline-none transition focus:border-[var(--mx-accent)] focus:ring-2 focus:ring-[var(--mx-ring)]",
        className,
      )}
      {...props}
    />
  );
});
