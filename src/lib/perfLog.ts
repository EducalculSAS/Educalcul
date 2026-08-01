// Log de diagnostic temporaire : mesure le temps de rendu serveur d'une page
// et l'écrit dans les logs Vercel (visible via get_runtime_logs / dashboard),
// pour comparer objectivement les pages entre elles pendant les tests.
export function logPageTiming(path: string, startedAt: number) {
  const ms = Math.round(performance.now() - startedAt);
  console.log(`[perf] ${path} rendered in ${ms}ms`);
}
