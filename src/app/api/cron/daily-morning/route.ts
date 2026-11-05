import { runCronJobs } from "@/lib/cronDispatch";
import { GET as dataRetention } from "@/app/api/cron/data-retention/route";
import { GET as gradePromotion } from "@/app/api/cron/grade-promotion/route";
import { GET as scheduledEmails } from "@/app/api/cron/scheduled-emails/route";

export const maxDuration = 300;

// Tâches quotidiennes du matin (7 h UTC), enchaînées : purge et engagements de confidentialité, passage de classe, e-mails planifiés.
export async function GET(req: Request) {
  return runCronJobs(req, [
    { name: "data-retention", run: dataRetention },
    { name: "grade-promotion", run: gradePromotion },
    { name: "scheduled-emails", run: scheduledEmails },
  ]);
}
