interface EmptyStateProps {
  message?: string;
}

export function EmptyState({
  message = "Paste a review, an essay or any text. Around 40 words or more works best.",
}: EmptyStateProps) {
  return (
    <div
      className="py-12 text-center"
      style={{
        fontFamily: "var(--font-text)",
        fontStyle: "italic",
        color: "var(--ink-faint)",
        fontSize: "var(--fs-body)",
      }}
    >
      <p className="m-0 max-w-md mx-auto">{message}</p>
    </div>
  );
}
