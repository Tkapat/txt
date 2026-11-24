"use client";

import type { ReviewsReport } from "@/shared/types";
import { PrevalenceFigure } from "./PrevalenceFigure";
import { EvidenceList } from "@/frontend/components/result/EvidenceList";
import { ClusterNote } from "./ClusterNote";
import { ReviewRow } from "./ReviewRow";
import { Disclaimer } from "@/frontend/components/result/Disclaimer";
import { PaperSheet } from "@/frontend/components/paper/PaperSheet";
import { RuleLine } from "@/frontend/components/paper/RuleLine";
import { warningMessage } from "@/frontend/lib/format";
import { useState } from "react";

interface ReviewsReportViewProps {
  report: ReviewsReport;
}

export function ReviewsReportView({ report }: ReviewsReportViewProps) {
  const [showAll, setShowAll] = useState(false);
  const displayedReviews = showAll
    ? report.reviews
    : report.reviews.slice(0, 50);
  const warnings = report.warnings
    .map(warningMessage)
    .filter((w): w is string => w !== null);

  return (
    <PaperSheet className="mt-8 animate-sheet-bounce">
      {/* Prevalence */}
      <PrevalenceFigure
        prevalence={report.prevalence}
        analyzed={report.analyzed}
        flaggedCount={report.flaggedCount}
        skippedShort={report.skippedShort}
        total={report.total}
      />

      <RuleLine className="my-6" />

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-4 flex flex-col gap-1">
          {warnings.map((w, i) => (
            <p
              key={i}
              className="m-0 text-xs"
              style={{
                color: "var(--stamp-amber)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Evidence */}
      {report.topEvidence.length > 0 && (
        <div className="mb-6">
          <EvidenceList
            evidence={report.topEvidence}
            activeIndex={null}
            onHover={() => {}}
          />
        </div>
      )}

      {/* Cluster note */}
      {report.groupSignals.clusters > 0 && (
        <div className="mb-6">
          <ClusterNote groupSignals={report.groupSignals} />
        </div>
      )}

      {/* Planned Feature: Browser Extension & Direct Store Link */}
      <div
        className="my-6 p-4 rounded-sm border"
        style={{
          borderColor: "var(--rule)",
          background: "var(--paper-edge)",
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono uppercase tracking-wider"
              style={{ color: "var(--pen-blue)", fontWeight: 500 }}
            >
              Planned Feature
            </span>
            <span
              className="px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-mono tracking-wider"
              style={{
                border: "1px solid var(--rule)",
                color: "var(--ink-soft)",
              }}
            >
              Store Link & Extension
            </span>
          </div>
          <span className="mono-label text-xs">Roadmap</span>
        </div>
        <p
          className="m-0 text-sm"
          style={{
            fontFamily: "var(--font-text)",
            color: "var(--ink-soft)",
            lineHeight: 1.5,
          }}
        >
          Direct product link analysis and automatic Amazon/e-commerce browser extension integration are planned for one-click review scanning directly while shopping.
        </p>
      </div>

      <RuleLine className="my-6" />

      {/* Reviews table */}
      <div>
        <h3 className="mono-label mb-3">
          All reviews ({report.reviews.length})
        </h3>
        <div className="flex flex-col gap-1">
          {displayedReviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </div>
        {!showAll && report.reviews.length > 50 && (
          <button
            className="btn-secondary mt-3"
            onClick={() => setShowAll(true)}
          >
            Show all {report.reviews.length} reviews
          </button>
        )}
      </div>

      <div className="mt-8">
        <Disclaimer />
      </div>
    </PaperSheet>
  );
}
