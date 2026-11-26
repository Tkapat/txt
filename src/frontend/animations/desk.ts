import gsap from "gsap";

/** Stickers and sketches "stick on" after the sheet has landed. */
export function stickOn(scope: HTMLElement, delay = 0) {
  const items = scope.querySelectorAll(".desk-item");
  return gsap.from(items, {
    opacity: 0,
    scale: 1.12,
    y: -10,
    duration: 0.45,
    ease: "power2.out",
    stagger: 0.09,
    delay,
  });
}

export function dropClip(clip: SVGElement) {
  return gsap.from(clip, {
    y: -24,
    opacity: 0,
    duration: 0.5,
    ease: "power3.out",
  });
}

export function wipeSwipe(swipe: HTMLElement) {
  return gsap.from(swipe, {
    scaleX: 0,
    duration: 0.5,
    ease: "power2.out",
  });
}

/**
 * Page-load intro for the desk layer. The sheet itself lands through the CSS
 * `sheet-in` animation; this adds the paperclip, the hero swipe and the
 * stick-on of the desk items. Returns a cleanup that reverts every inline style.
 */
export function playIntro(scope: HTMLElement): () => void {
  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return () => {};
  }

  const context = gsap.context(() => {
    const clip = scope.querySelector<SVGElement>(".clip");
    const swipe = scope.querySelector<HTMLElement>(".swipe");
    const timeline = gsap.timeline();

    if (clip) timeline.add(dropClip(clip), 0.55);
    if (swipe) timeline.add(wipeSwipe(swipe), 0.45);

    const layer = document.querySelector<HTMLElement>(".desk-layer");
    if (layer) stickOn(layer, 0.5);
  }, scope);

  return () => context.revert();
}
