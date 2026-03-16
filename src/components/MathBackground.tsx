import styles from './MathBackground.module.css';

export default function MathBackground() {
  const symbols = [
    "π", "∑", "√", "∫", "≠", "∞", "≈", "÷", "×", "±", 
    "≤", "≥", "α", "β", "Δ", "θ", "λ", "μ", "∂", "∇",
    "∀", "∃", "∈", "∉", "⊂", "⊃", "∪", "∩", "∧", "∨",
    "⊕", "⊗", "⊥", "angle", "⊥", "≡", "≅", "∝", "∞", "∅",
    "N", "Z", "Q", "R", "C", "H", "O", "S", "P", "E",
    "sin", "cos", "tan", "log", "ln", "exp", "lim", "max", "min", "mod"
  ];

  return (
    <div className={styles.mathSymbolsGlobal}>
      {symbols.map((symbol, index) => (
        <span key={index}>{symbol}</span>
      ))}
    </div>
  );
}
