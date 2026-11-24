export function InkLoader() {
  return (
    <div
      className="flex flex-col items-center gap-3 py-8"
      role="status"
      aria-label="Analysing text"
    >
      <div
        className="w-full max-w-xs h-px relative overflow-hidden"
        style={{ background: "var(--rule)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "var(--ink)",
            transformOrigin: "left",
            animation:
              "ink-draw 1.2s linear infinite alternate",
          }}
        />
      </div>
      <p
        className="m-0"
        style={{
          fontFamily: "var(--font-text)",
          fontStyle: "italic",
          color: "var(--ink-soft)",
          fontSize: "var(--fs-small)",
        }}
      >
        Reading…
      </p>
    </div>
  );
}
