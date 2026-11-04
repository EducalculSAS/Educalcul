import { MISSIONS, type Mission, type MissionStats } from "@/lib/cosmetics/catalog";

export interface RequirementProgress {
  stat: Mission["requirements"][number]["stat"];
  min: number;
  value: number;
  done: boolean;
}

export interface MissionProgress {
  mission: Mission;
  requirements: RequirementProgress[];
  /** 0 à 1 : moyenne de l'avancement de chaque condition (chacune plafonnée à 1). */
  ratio: number;
  completed: boolean;
}

/** Avancement d'une mission à partir des compteurs de l'élève. */
export function evaluateMission(mission: Mission, stats: MissionStats): MissionProgress {
  const requirements = mission.requirements.map((r) => {
    const value = Math.max(0, stats[r.stat] ?? 0);
    return { stat: r.stat, min: r.min, value, done: value >= r.min };
  });
  const ratio = requirements.length === 0 ? 1 : requirements.reduce((s, r) => s + Math.min(1, r.value / r.min), 0) / requirements.length;
  return { mission, requirements, ratio, completed: requirements.every((r) => r.done) };
}

export const evaluateAllMissions = (stats: MissionStats): MissionProgress[] => MISSIONS.map((m) => evaluateMission(m, stats));

/** Missions accomplies que l'élève n'a pas encore enregistrées : à lui attribuer maintenant. */
export function missionsToAward(stats: MissionStats, ownedIds: Iterable<string>): Mission[] {
  const owned = new Set(ownedIds);
  return evaluateAllMissions(stats).filter((p) => p.completed && !owned.has(p.mission.id)).map((p) => p.mission);
}
