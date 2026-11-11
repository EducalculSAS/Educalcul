import { describe, expect, it } from "vitest";
import { nextBadgeGoals } from "@/lib/badgeGoals";

const b = (id: number, type: string, value: number) => ({ id, name: `b${id}`, icon: "star", requirement_type: type, requirement_value: value });
const BADGES = [b(1, "exercise_count", 1), b(2, "exercise_count", 10), b(3, "exercise_count", 50), b(4, "quiz_count", 5), b(5, "course_count", 3), b(6, "login_streak", 7)];

describe("nextBadgeGoals", () => {
  it("propose le premier palier non obtenu de chaque catégorie", () => {
    const goals = nextBadgeGoals(BADGES, [1], { exercise_count: 4 }, 10);
    expect(goals.map((g) => g.badge.id).sort()).toEqual([2, 4, 5, 6]);
  });

  it("classe les objectifs les plus avancés en premier et respecte la limite", () => {
    const goals = nextBadgeGoals(BADGES, [1], { exercise_count: 4, quiz_count: 4, course_count: 1, login_streak: 0 }, 2);
    expect(goals.map((g) => g.badge.id)).toEqual([4, 2]);
    expect(goals[0]).toMatchObject({ current: 4, target: 5, ready: false });
  });

  it("signale un badge atteint mais pas encore remis, sans dépasser le seuil", () => {
    const [goal] = nextBadgeGoals(BADGES, [], { exercise_count: 12 }, 1);
    expect(goal).toMatchObject({ current: 1, target: 1, ratio: 1, ready: true });
    expect(goal.badge.id).toBe(1);
  });

  it("ne propose rien quand tout est obtenu", () => {
    expect(nextBadgeGoals(BADGES, BADGES.map((x) => x.id), {})).toEqual([]);
  });
});
