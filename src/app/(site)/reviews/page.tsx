"use client";

import { useReviewsReport } from "@/frontend/hooks/useReviewsReport";
import { PaperSheet } from "@/frontend/components/paper/PaperSheet";
import { RuleLine } from "@/frontend/components/paper/RuleLine";
import { ReviewsInput } from "@/frontend/components/reviews/ReviewsInput";
import { ReviewsReportView } from "@/frontend/components/reviews/ReviewsReportView";
import { InkLoader } from "@/frontend/components/feedback/InkLoader";
import { ErrorNote } from "@/frontend/components/feedback/ErrorNote";
import type { ReviewInput } from "@/shared/types";

export default function ReviewsPage() {
  const { state, runJson, runCsv, reset } = useReviewsReport();
  const isLoading = state.status === "loading";

  function handleSubmitText(reviews: ReviewInput[]) {
    runJson(reviews);
  }

  function handleSubmitCsv(file: File) {
    runCsv(file);
  }

  return (
    <>
      <PaperSheet>
        {/* Hero */}
        <div className="mb-6 animate-fade-up">
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-h2)",
              fontWeight: 300,
              color: "var(--ink)",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Review analyser
          </h1>
          <p
            className="mt-2 mb-0"
            style={{
              fontFamily: "var(--font-text)",
              color: "var(--ink-soft)",
              maxWidth: "55ch",
            }}
          >
            Paste product reviews or upload a CSV to estimate how many look
            AI-written. The percentage is adjusted for detector accuracy and
            shown with a range.
          </p>
        </div>

        <RuleLine className="mb-6" />

        <ReviewsInput
          onSubmitText={handleSubmitText}
          onSubmitCsv={handleSubmitCsv}
          disabled={isLoading}
        />
      </PaperSheet>

      {/* Results */}
      {state.status === "loading" && <InkLoader />}

      {state.status === "error" && (
        <div className="mt-6 mx-auto" style={{ maxWidth: "var(--sheet-w)" }}>
          <ErrorNote
            message={state.message}
            code={state.code}
            onRetry={reset}
          />
        </div>
      )}

      {state.status === "success" && (
        <ReviewsReportView report={state.report} />
      )}
    </>
  );
}
