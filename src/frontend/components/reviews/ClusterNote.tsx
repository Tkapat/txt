interface ClusterNoteProps {
  groupSignals: {
    clusters: number;
    reviewsInClusters: number;
    note: string;
  };
}

export function ClusterNote({ groupSignals }: ClusterNoteProps) {
  return (
    <div
      className="p-4 rounded-sm animate-fade-in delay-5"
      style={{
        background: "var(--paper-edge)",
        border: "1px solid var(--rule)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="mono-label m-0">Pattern detected</h3>
        <span
          className="px-1.5 py-0.5 rounded-sm"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--stamp-amber)",
            border: "1px solid var(--stamp-amber)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          experimental
        </span>
      </div>
      <p
        className="m-0"
        style={{
          fontFamily: "var(--font-text)",
          fontSize: "var(--fs-small)",
          color: "var(--ink-soft)",
        }}
      >
        {groupSignals.reviewsInClusters} reviews share the same sentence
        structure across {groupSignals.clusters}{" "}
        {groupSignals.clusters === 1 ? "cluster" : "clusters"}.
      </p>
      <p
        className="m-0 mt-1"
        style={{
          fontFamily: "var(--font-text)",
          fontStyle: "italic",
          fontSize: "var(--fs-label)",
          color: "var(--ink-faint)",
        }}
      >
        {groupSignals.note}
      </p>
    </div>
  );
}
