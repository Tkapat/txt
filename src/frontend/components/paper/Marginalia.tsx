import type { ReactNode } from "react";

interface MarginaliaProps {
  children: ReactNode;
  className?: string;
}

export function Marginalia({ children, className }: MarginaliaProps) {
  return (
    <span
      className={`marginalia ${className ?? ""}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
