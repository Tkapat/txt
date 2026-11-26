"use client";

import { useEffect } from "react";
import { playIntro } from "@/frontend/animations/desk";

export function DeskIntro() {
  useEffect(() => {
    const scope = document.querySelector<HTMLElement>("[data-page-shell]");
    if (!scope) return;

    return playIntro(scope);
  }, []);

  return null;
}
