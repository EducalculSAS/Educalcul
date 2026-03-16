import React from "react";

export default function MathLoader() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative w-24 h-24">
        {/* Animated circles/orbit */}
        <div className="absolute inset-0 border-4 border-[var(--greek-blue)]/20 rounded-full animate-[spin_3s_linear_infinite]"></div>
        <div className="absolute inset-2 border-4 border-[var(--greek-gold)]/30 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
        
        {/* Floating Math Symbols */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[var(--greek-blue)] font-bold animate-bounce delay-0">
            ∑
          </span>
          <span className="absolute bottom-4 left-4 text-[var(--greek-gold)] font-bold animate-bounce delay-100">
            π
          </span>
          <span className="absolute bottom-4 right-4 text-[var(--greek-blue)] font-bold animate-bounce delay-200">
            x²
          </span>
          <span className="absolute top-1/2 right-1 text-[var(--greek-gold)] font-bold animate-pulse">
            +
          </span>
           <span className="absolute top-1/2 left-1 text-[var(--greek-gold)] font-bold animate-pulse delay-300">
            ÷
          </span>
        </div>
        
        {/* Central Pulse */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--greek-blue)] rounded-full animate-ping"></div>
      </div>
      <p className="mt-4 text-[var(--greek-blue)] font-[family-name:var(--font-display)] animate-pulse font-medium">
        Chargement...
      </p>
    </div>
  );
}
