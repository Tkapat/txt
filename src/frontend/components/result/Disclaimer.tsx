export function Disclaimer() {
  return (
    <p
      className="m-0 py-3"
      style={{
        fontFamily: "var(--font-text)",
        fontStyle: "italic",
        fontSize: "var(--fs-small)",
        color: "var(--ink-faint)",
        borderTop: "1px solid var(--rule)",
        lineHeight: 1.6,
      }}
    >
      txt gives a probability, not proof. Detectors can be wrong, and people use
      AI tools to polish honest writing. Do not use this result alone to judge
      someone.
    </p>
  );
}
