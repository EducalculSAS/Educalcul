const SYMS = ["∑", "π", "∞", "√", "Δ", "∫", "θ", "α", "≠", "≈", "±", "∂", "×", "÷", "φ", "λ"];

export default function FloatingSymbols({ count = 12 }: { count?: number }) {
  return (
    <>
      {SYMS.slice(0, count).map((s, i) => (
        <span
          key={i}
          className="absolute select-none pointer-events-none font-bold animate-float-symbol"
          style={{
            left: `${(i * 83 + 7) % 100}%`,
            top: `${(i * 57 + 11) % 100}%`,
            fontSize: `${1.0 + (i % 3) * 0.5}rem`,
            color: "var(--greek-gold)",
            opacity: 0.1,
            animationDelay: `${i * 0.6}s`,
            animationDuration: `${6 + (i % 4)}s`,
            fontFamily: "Georgia, serif",
          }}
        >
          {s}
        </span>
      ))}
    </>
  );
}
