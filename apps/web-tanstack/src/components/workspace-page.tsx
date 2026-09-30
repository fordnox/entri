import type { ReactNode } from "react";

const WIDTHS = {
  default: "max-w-2xl",
  wide: "max-w-5xl",
  full: "max-w-7xl",
} as const;

export function WorkspacePage({
  children,
  width = "default",
}: {
  children: ReactNode;
  /** Content column width. `default` fits settings forms; widen for table-heavy pages. */
  width?: keyof typeof WIDTHS;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-background">
      <div className={`mx-auto w-full ${WIDTHS[width]} flex-1 px-4 py-8 md:px-6`}>
        {children}
      </div>
    </div>
  );
}
