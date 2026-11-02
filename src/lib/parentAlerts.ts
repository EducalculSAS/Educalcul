import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/mailer";
import { childInactiveEmail } from "@/lib/emailTemplates";
import { selectAllPages } from "@/lib/selectAllPages";
import { DEFAULT_ALERT_PREFS, getAlertPrefs, getAlertPrefsMany, getStudentMeta, getStudentMetaMany, saveAlertMemory, type StudentMeta } from "@/lib/studentStore";
import { getChildPrefs, getChildPrefsMany, loadActivity, loadActivityMany, mondayOf, parisDay, summarize, type StudentSummary } from "@/lib/studentStats";

/**
 * Alertes utiles pour les parents (cloche + e-mail pour l'inactivité) et petits encouragements pour l'élève :
 * - un chapitre terminé, une cible de la semaine atteinte, un cap de série (7, 14, 30, 60, 100 jours) ;
 * - un enfant qui n'a plus rien fait depuis N jours (tâche planifiée quotidienne).
 * Chaque alerte n'est envoyée qu'une fois (mémoire dans les données de l'élève).
 */


/** Mémoire des alertes déjà envoyées (colonnes alert_* de student_meta). */
interface AlertMemory {
  weeklyTargetWeek: string | null;
  streakMilestone: number;
  goalDay: string | null;
  inactiveSince: string | null;
}
const memoryOf = (m: StudentMeta): AlertMemory => ({ weeklyTargetWeek: m.alertWeeklyTargetWeek, streakMilestone: m.alertStreakMilestone, goalDay: m.alertGoalDay, inactiveSince: m.alertInactiveSince });
const saveMemory = (id: number, m: AlertMemory) =>
  saveAlertMemory(id, { alertGoalDay: m.goalDay, alertWeeklyTargetWeek: m.weeklyTargetWeek, alertStreakMilestone: m.streakMilestone, alertInactiveSince: m.inactiveSince });
const EMPTY_MEMORY: AlertMemory = memoryOf({ srsMastered: 0, shareVersion: 1, alertGoalDay: null, alertWeeklyTargetWeek: null, alertStreakMilestone: 0, alertInactiveSince: null });
const STREAK_MILESTONES = [7, 14, 30, 60, 100];

interface ChildInfo {
  id: number;
  auth_id: string;
  first_name: string | null;
  parent_id: number | null;
}
interface ParentInfo {
  id: number;
  auth_id: string;
  email: string;
  first_name: string | null;
}

const getChild = async (childId: number): Promise<ChildInfo | null> =>
  (await supabaseAdmin.from("users").select("id, auth_id, first_name, parent_id").eq("id", childId).eq("role", "child").maybeSingle()).data;
const getParent = async (parentId: number): Promise<ParentInfo | null> =>
  (await supabaseAdmin.from("users").select("id, auth_id, email, first_name").eq("id", parentId).eq("role", "parent").maybeSingle()).data;

/** À appeler après chaque activité terminée d'un élève (exercice, quiz, cours, séance à revoir). */
export async function afterActivity(childId: number, event: { courseCompleted?: { title: string } } = {}): Promise<void> {
  const child = await getChild(childId);
  if (!child) return;
  const [activity, prefs, meta] = await Promise.all([loadActivity(childId), getChildPrefs(childId), getStudentMeta(childId)]);
  const memory = memoryOf(meta);
  const summary = summarize(activity, prefs);
  const today = parisDay();
  const next = { ...memory, inactiveSince: null as string | null };

  // Pour l'élève : objectif du jour atteint (une fois par jour).
  if (summary.goalReached && memory.goalDay !== today) {
    next.goalDay = today;
    await notify({ userId: child.auth_id, type: "goal", title: "Objectif du jour atteint !", body: `Tu as terminé ${summary.today} activité${summary.today > 1 ? "s" : ""} aujourd'hui. Série : ${summary.streak} jour${summary.streak > 1 ? "s" : ""}.`, link: "/child/dashboard" });
  }

  const parent = child.parent_id ? await getParent(child.parent_id) : null;
  if (parent) {
    const alertPrefs = await getAlertPrefs(parent.id);
    const name = child.first_name || "Votre enfant";
    if (event.courseCompleted && alertPrefs.chapter) {
      await notify({ userId: parent.auth_id, type: "child_chapter", title: `${name} a terminé un cours`, body: event.courseCompleted.title, link: `/parent/child/${child.id}` });
    }
    if (alertPrefs.goals) {
      const monday = mondayOf(today);
      if (summary.weeklyTarget && summary.weekTotal >= summary.weeklyTarget && memory.weeklyTargetWeek !== monday) {
        next.weeklyTargetWeek = monday;
        await notify({ userId: parent.auth_id, type: "child_goal", title: `${name} a atteint la cible de la semaine`, body: `${summary.weekTotal} activités sur ${summary.weeklyTarget} prévues.`, link: `/parent/child/${child.id}` });
      }
      const milestone = [...STREAK_MILESTONES].reverse().find((m) => summary.streak >= m) ?? 0;
      if (milestone > memory.streakMilestone) {
        next.streakMilestone = milestone;
        await notify({ userId: parent.auth_id, type: "child_streak", title: `${name} : ${milestone} jours de suite !`, body: "Une belle régularité, ça mérite d'être encouragé.", link: `/parent/child/${child.id}` });
      }
    }
  }
  // La série repart de zéro si elle est cassée : le prochain cap pourra de nouveau être fêté.
  if (summary.streak < memory.streakMilestone) next.streakMilestone = STREAK_MILESTONES.filter((m) => m <= summary.streak).pop() ?? 0;
  if (JSON.stringify(next) !== JSON.stringify(memory)) await saveMemory(childId, next);
}

/** Tâche quotidienne : prévient les parents dont un enfant n'a plus rien fait depuis plusieurs jours. */
export async function runInactivityAlerts(now = new Date(), opts: { dryRun?: boolean } = {}) {
  const children = await selectAllPages<ChildInfo & { status: string | null }>((from, to) =>
    supabaseAdmin.from("users").select("id, auth_id, first_name, parent_id, status").eq("role", "child").not("parent_id", "is", null).order("id").range(from, to),
  );
  const active = children.filter((c) => c.status !== "inactive");
  const parentIds = [...new Set(active.map((c) => c.parent_id as number))];
  const parents = new Map<number, ParentInfo>();
  for (let i = 0; i < parentIds.length; i += 200) {
    const { data } = await supabaseAdmin.from("users").select("id, auth_id, email, first_name").in("id", parentIds.slice(i, i + 200)).neq("status", "inactive");
    for (const p of data ?? []) parents.set(p.id, p);
  }
  const alertPrefs = await getAlertPrefsMany(parentIds);

  let notified = 0;
  let emailed = 0;
  for (let i = 0; i < active.length; i += 100) {
    const chunk = active.slice(i, i + 100);
    const ids = chunk.map((c) => c.id);
    const [activities, childPrefs, memories] = await Promise.all([
      loadActivityMany(ids, 30),
      getChildPrefsMany(ids),
      getStudentMetaMany(ids),
    ]);
    for (const child of chunk) {
      const parent = parents.get(child.parent_id as number);
      if (!parent) continue;
      const prefs = alertPrefs.get(String(parent.id)) ?? DEFAULT_ALERT_PREFS;
      if (!prefs.inactivity) continue;
      const summary: StudentSummary = summarize(activities.get(child.id)!, childPrefs.get(String(child.id)) ?? (await getChildPrefs(child.id)), now);
      // Jamais actif : on ne relance pas (un compte tout neuf n'est pas « inactif »).
      if (summary.daysSinceActive === null || summary.daysSinceActive < prefs.inactivityDays) continue;
      const memory = memories.get(String(child.id)) ? memoryOf(memories.get(String(child.id))!) : EMPTY_MEMORY;
      const lastDay = summary.last ? parisDay(summary.last) : null;
      if (!lastDay || memory.inactiveSince === lastDay) continue; // déjà prévenu pour cette période d'inactivité
      if (opts.dryRun) {
        notified++;
        continue;
      }
      const name = child.first_name || "Votre enfant";
      await notify({ userId: parent.auth_id, type: "child_inactive", title: `${name} n'a pas travaillé depuis ${summary.daysSinceActive} jours`, body: "Un encouragement, ou un objectif plus léger, peut aider.", link: `/parent/child/${child.id}` });
      notified++;
      if (prefs.email && parent.email) {
        const mail = childInactiveEmail(parent.first_name || "", name, summary.daysSinceActive);
        const res = await sendEmail({ toEmail: parent.email, toName: parent.first_name || "Parent", ...mail });
        if (res.success) emailed++;
      }
      await saveMemory(child.id, { ...memory, inactiveSince: lastDay });
    }
  }
  return { children: active.length, notified, emailed };
}
