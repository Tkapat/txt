interface ErrorNoteProps {
  message: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorNote({ message, code, onRetry }: ErrorNoteProps) {
  const userMessage =
    code === "rate_limited"
      ? "Too many requests. Please wait a minute."
      : code === "model_unavailable"
        ? "The detection model is not available right now. Please try again later."
        : message;

  return (
    <div
      className="p-4 rounded-sm animate-fade-in"
      style={{
        background: "var(--paper-edge)",
        border: "1px solid var(--rule)",
        borderLeft: "3px solid var(--stamp-amber)",
      }}
      role="alert"
    >
      <p
        className="m-0 mb-2"
        style={{ color: "var(--stamp-amber)", fontWeight: 500 }}
      >
        {userMessage}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-secondary"
          style={{ color: "var(--stamp-amber)" }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
