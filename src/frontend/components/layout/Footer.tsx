export function Footer() {
  return (
    <footer
      className="footer py-6 px-6 text-center"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-label)",
        color: "var(--ink-faint)",
        letterSpacing: "0.04em",
      }}
      data-print-hide
    >
      <p className="m-0">
        txt gives a probability, not proof. No text is stored.
      </p>
    </footer>
  );
}
