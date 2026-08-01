import AppAdminLoader from "@/components/AppAdminLoader";

// Squelette affiché pendant le rendu serveur ET utilisé par Next.js comme
// limite de prefetch : sans ce fichier, survoler/afficher un <Link> vers
// cette page dynamique déclenchait son rendu complet (toutes les requêtes
// DB) en arrière-plan dès qu il apparaissait à l écran (vu en prod : des
// dizaines de requêtes simultanées vers Supabase juste en affichant le
// tableau de bord). Avec ce fichier, le prefetch ne récupère que ce
// squelette statique, jamais les données.
export default function Loading() {
  return <AppAdminLoader />;
}
