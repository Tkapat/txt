import Image from "next/image";
import type { CSSProperties } from "react";
import { DESK_ITEMS } from "@/frontend/lib/desk-items";

export function DeskLayer() {
  return (
    <div className="desk-layer" aria-hidden="true">
      {DESK_ITEMS.map((it) => (
        <div
          key={it.id}
          className="desk-item"
          data-kind={it.kind}
          data-side={it.side}
          data-tier={it.tier}
          data-tape={it.tape ? "true" : undefined}
          style={
            {
              "--w": it.w,
              "--top": it.top,
              "--tuck": it.tuck,
              "--rot": it.rot,
            } as CSSProperties
          }
        >
          <Image
            src={it.src}
            alt=""
            width={it.w}
            height={it.h}
            loading="lazy"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
