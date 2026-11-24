"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/frontend/lib/cn";

const NAV_ITEMS = [
  { href: "/", label: "Detector" },
  { href: "/reviews", label: "Reviews" },
  { href: "/method", label: "Method" },
] as const;

export function Masthead() {
  const pathname = usePathname();

  return (
    <header className="masthead" data-print-hide>
      <nav
        className="flex items-center justify-between gap-6 px-6 py-4 mx-auto"
        style={{ maxWidth: "var(--sheet-w)" }}
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-baseline gap-0 no-underline"
          aria-label="txt home"
        >
          <span
            className="text-2xl font-light italic tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
          >
            txt
          </span>
          <span
            className="animate-pulse text-2xl font-light"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
            aria-hidden="true"
          >
            _
          </span>
        </Link>

        <ul className="flex items-center gap-1 list-none m-0 p-0">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "mono-label px-3 py-2 rounded-sm no-underline transition-colors",
                    "hover:bg-[var(--paper-edge)]",
                    isActive && "text-[var(--ink)] font-medium",
                    !isActive && "text-[var(--ink-soft)]",
                  )}
                  style={{
                    borderBottom: isActive
                      ? "2px solid var(--ink)"
                      : "2px solid transparent",
                  }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
