interface PaperClipProps {
  corner?: "tr" | "tl";
}

export function PaperClip({ corner = "tr" }: PaperClipProps) {
  return (
    <svg
      className="clip"
      data-corner={corner}
      width="34"
      height="86"
      viewBox="0 0 34 86"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M13 58 V20 a8 8 0 0 1 16 0 V66 a12 12 0 0 1 -24 0 V30 a8 8 0 0 1 16 0 V62"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
