import type { ReactNode } from "react";

interface MarginaliaProps {
  children: ReactNode;
  className?: string;
  arrow?: boolean;
}

export function Marginalia({
  children,
  className,
  arrow = false,
}: MarginaliaProps) {
  return (
    <span className={`marginalia ${className ?? ""}`} aria-hidden="true">
      {arrow && "→ "}
      {children}
    </span>
  );
}
