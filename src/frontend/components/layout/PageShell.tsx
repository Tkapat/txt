import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      className={`flex-1 px-4 py-8 md:px-6 md:py-12 ${className ?? ""}`}
      style={{ background: "var(--desk)" }}
    >
      {children}
    </main>
  );
}
