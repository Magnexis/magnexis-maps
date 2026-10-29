import { clsx } from "clsx";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  "aria-label": ariaLabel,
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        "inline-flex rounded-[var(--mx-radius)] bg-[var(--mx-surface-2)] p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={clsx(
              "rounded-[10px] px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-[var(--mx-accent)] text-white shadow-sm"
                : "text-[var(--mx-text-muted)] hover:text-[var(--mx-text)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
