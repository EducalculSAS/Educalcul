// Ouvre un onglet vide de façon SYNCHRONE (avant tout await) pour éviter le
// bloqueur de popups de Safari mobile (voir handlePreview dans
// AdminCoursesClient/AdminExercisesClient/AdminQuizzesClient), puis y écrit
// immédiatement une page de chargement au lieu de laisser un onglet blanc le
// temps que l'aperçu (POST + génération) se termine.
export function openPreviewLoadingWindow(): Window | null {
  const win = window.open("", "_blank");
  if (win) {
    // Réplique en HTML brut le loader du site (AppLoader) : logo qui pulse +
    // trois points rebondissants aux couleurs du thème.
    win.document.write(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Chargement de l'aperçu…</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: #faf7f2;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  }
  .wrap { text-align: center; color: #0f1e3a; }
  .logo {
    width: 64px; height: 64px; margin: 0 auto 16px; display: block;
    animation: pulse 1.6s ease-in-out infinite;
  }
  .dots { display: flex; gap: 6px; justify-content: center; }
  .dots span {
    width: 8px; height: 8px; border-radius: 50%;
    animation: bounce 0.9s infinite ease-in-out;
  }
  .dots span:nth-child(1) { background: #0f1e3a; animation-delay: 0ms; }
  .dots span:nth-child(2) { background: #c5a148; animation-delay: 150ms; }
  .dots span:nth-child(3) { background: #0f1e3a; animation-delay: 300ms; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
  p { margin: 14px 0 0; font-size: 14px; opacity: 0.6; }
</style>
</head>
<body>
  <div class="wrap">
    <img class="logo" src="/logo.png" alt="Educalcul" />
    <div class="dots"><span></span><span></span><span></span></div>
    <p>Préparation de l'aperçu…</p>
  </div>
</body>
</html>`);
    win.document.close();
  }
  return win;
}

