import type { ReactNode } from "react";
import { DeskLayer } from "@/frontend/components/art/DeskLayer";
import { DeskIntro } from "./DeskIntro";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      data-page-shell
      className={`page-shell flex-1 px-4 py-8 md:px-6 md:py-12 ${className ?? ""}`}
    >
      <DeskLayer />
      <DeskIntro />
      {children}
    </main>
  );
}
