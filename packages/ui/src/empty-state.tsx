import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <p className="font-display text-base font-semibold text-[var(--mx-text)]">
        {title}
      </p>
      {description ? (
        <p className="max-w-xs text-sm text-[var(--mx-text-muted)]">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
