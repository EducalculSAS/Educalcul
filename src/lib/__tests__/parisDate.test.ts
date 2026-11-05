import { describe, expect, it } from "vitest";
import { formatParisDayMonth } from "@/lib/parisDate";

describe("dates abrégées, identiques sur tous les moteurs", () => {
  it("écrit le jour, le mois en toutes lettres abrégées et l'heure de Paris", () => {
    expect(formatParisDayMonth("2026-11-05T12:38:15Z")).toBe("05 nov.");
    expect(formatParisDayMonth("2026-11-05T12:38:15Z", { time: true })).toBe("05 nov. 13:38"); // heure d'hiver : UTC+1
    expect(formatParisDayMonth("2026-07-01T22:05:00Z", { time: true })).toBe("02 juil. 00:05"); // heure d'été : UTC+2, jour suivant
    expect(formatParisDayMonth("2026-02-03T08:00:00Z", { pad: false })).toBe("3 févr.");
  });
  it("tous les mois", () => {
    const labels = Array.from({ length: 12 }, (_, i) => formatParisDayMonth(new Date(Date.UTC(2026, i, 15, 12))));
    expect(labels).toEqual(["15 janv.", "15 févr.", "15 mars", "15 avr.", "15 mai", "15 juin", "15 juil.", "15 août", "15 sept.", "15 oct.", "15 nov.", "15 déc."]);
  });
  it("une date invalide donne un texte vide, pas une erreur", () => {
    expect(formatParisDayMonth("n'importe quoi")).toBe("");
  });
});
