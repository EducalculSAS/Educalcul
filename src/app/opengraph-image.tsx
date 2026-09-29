import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Educalcul : Les maths enfin maîtrisés";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f1e3a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background symbols */}
        {["∑", "π", "√", "∫", "∞", "Δ"].map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              fontSize: 120,
              color: "#c5a148",
              opacity: 0.08,
              left: `${[6, 87, 12, 82, 50, 30][i]}%`,
              top: `${[10, 5, 60, 40, 75, 20][i]}%`,
            }}
          >
            {s}
          </div>
        ))}

        {/* Gold top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "#c5a148" }} />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
          {/* Logo text fallback */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                background: "#c5a148",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                color: "#0f1e3a",
                fontWeight: "bold",
              }}
            >
              E
            </div>
            <span style={{ fontSize: 52, fontWeight: "bold", color: "#f0ede8", letterSpacing: -1 }}>
              Educalcul
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 56, fontWeight: "bold", color: "#f0ede8", textAlign: "center", lineHeight: 1.1 }}>
              Les maths{" "}
              <span style={{ color: "#c5a148" }}>enfin maîtrisés</span>
            </div>
            <div style={{ fontSize: 26, color: "rgba(240,237,232,0.55)", textAlign: "center", maxWidth: 700 }}>
              Du CP à la Terminale · IA pédagogique · Suivi parental
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {["Programme officiel", "Essai gratuit", "Toutes filières"].map((label) => (
              <div
                key={label}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid rgba(197,161,72,0.35)",
                  color: "#c5a148",
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom URL */}
        <div style={{ position: "absolute", bottom: 28, fontSize: 20, color: "rgba(240,237,232,0.3)" }}>
          educalcul.fr
        </div>
      </div>
    ),
    { ...size }
  );
}
