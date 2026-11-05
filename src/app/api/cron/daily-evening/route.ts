import { runCronJobs } from "@/lib/cronDispatch";
import { GET as familyAlerts } from "@/app/api/cron/family-alerts/route";
import { GET as minigamesDaily } from "@/app/api/cron/minigames-daily/route";

export const maxDuration = 300;

// Tâches quotidiennes du soir (17 h UTC), enchaînées : alertes aux parents d'abord (rapides), puis fiches des mini-jeux
// (génération longue, reprise le lendemain si elle n'a pas fini : elle ne crée que les fiches manquantes).
export async function GET(req: Request) {
  return runCronJobs(req, [
    { name: "family-alerts", run: familyAlerts },
    { name: "minigames-daily", run: minigamesDaily },
  ]);
}
