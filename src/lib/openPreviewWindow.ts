// Ouvre un onglet vide de façon SYNCHRONE (avant tout await) pour éviter le
// bloqueur de popups de Safari mobile (voir handlePreview dans
// AdminCoursesClient/AdminExercisesClient/AdminQuizzesClient), puis y écrit
// immédiatement une page de chargement au lieu de laisser un onglet blanc le
// temps que l'aperçu (POST + génération) se termine.
export function openPreviewLoadingWindow(): Window | null {
  const win = window.open("", "_blank");
  if (win) {
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
  .spinner {
    width: 40px; height: 40px; margin: 0 auto 16px;
    border: 3px solid rgba(15,30,58,0.15);
    border-top-color: #c5a148;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { margin: 0; font-size: 15px; opacity: 0.75; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="spinner"></div>
    <p>Préparation de l'aperçu…</p>
  </div>
</body>
</html>`);
    win.document.close();
  }
  return win;
}

