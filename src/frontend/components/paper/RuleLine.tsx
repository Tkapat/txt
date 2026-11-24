interface RuleLineProps {
  animate?: boolean;
  className?: string;
}

export function RuleLine({ animate = true, className }: RuleLineProps) {
  return (
    <div
      className={`rule-draw ${animate ? "animate-rule-draw" : ""} ${className ?? ""}`}
      role="separator"
    />
  );
}
