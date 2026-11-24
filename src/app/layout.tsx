import type { Metadata } from "next";
import { fraunces, newsreader, plexMono, caveat } from "./fonts";
import { Masthead } from "@/frontend/components/layout/Masthead";
import { Footer } from "@/frontend/components/layout/Footer";
import { PageShell } from "@/frontend/components/layout/PageShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "txt — AI writing detection",
  description:
    "Detect AI-generated text in essays, documents and product reviews. Privacy-first, open-source, runs locally.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${newsreader.variable} ${plexMono.variable} ${caveat.variable}`}
    >
      <body>
        {/* SVG filter for rough stamp edges */}
        <svg
          width="0"
          height="0"
          aria-hidden="true"
          style={{ position: "absolute" }}
        >
          <filter id="rough">
            <feTurbulence
              baseFrequency="0.04"
              numOctaves={2}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={2.2}
            />
          </filter>
        </svg>
        <div className="flex flex-col min-h-screen" style={{ background: "var(--desk)" }}>
          <Masthead />
          <PageShell>{children}</PageShell>
          <Footer />
        </div>
      </body>
    </html>
  );
}
