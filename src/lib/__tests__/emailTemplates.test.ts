import { describe, expect, it } from "vitest";
import * as T from "@/lib/emailTemplates";

const NAME = "Léa";
const URL_OK = "https://educalcul.com/auth/callback?token=abc";
const samples: Record<string, { subject: string; textPart: string; htmlPart: string }> = {
  passwordChanged: T.passwordChangedEmail(NAME),
  twoFactorCode: T.twoFactorCodeEmail(NAME, "123456"),
  twoFactorToggledOn: T.twoFactorToggledEmail(NAME, true),
  twoFactorToggledOff: T.twoFactorToggledEmail(NAME, false),
  emailChanged: T.emailChangedEmail(NAME, "nouveau@example.com"),
  methodLinked: T.signInMethodLinkedEmail(NAME, "Google"),
  methodRemoved: T.signInMethodRemovedEmail(NAME, "Google"),
  dataExport: T.dataExportRequestEmail(NAME, "https://educalcul.com/api/parent/export-data/download?token=t"),
  welcomePaid: T.welcomeEmail(NAME, URL_OK, true),
  welcomeFree: T.welcomeEmail(NAME, URL_OK, false),
  trialStarted: T.trialStartedEmail(NAME, "Famille", "12 novembre 2026", "9,90 €"),
  trialEnding: T.trialEndingEmail(NAME, "Famille", "12 novembre 2026", "9,90 €"),
  paymentSucceeded: T.paymentSucceededEmail(NAME, "9,90 €", "Famille", "12 décembre 2026", "https://invoice.stripe.com/i/x"),
  paymentSucceededNoNext: T.paymentSucceededEmail(NAME, "9,90 €", "Famille", null, "https://invoice.stripe.com/i/x"),
  paymentFailed: T.paymentFailedEmail(NAME),
  cancellationScheduled: T.cancellationScheduledEmail(NAME, "Famille", "12 décembre 2026"),
  cancellationRevoked: T.cancellationRevokedEmail(NAME, "Famille", "12 décembre 2026"),
  cancellationRevokedNoNext: T.cancellationRevokedEmail(NAME, "Famille", null),
  subscriptionEnded: T.subscriptionEndedEmail(NAME, "Famille"),
  withdrawal: T.withdrawalConfirmedEmail(NAME, "Famille", "2 novembre 2026", "9,90 €"),
  withdrawalNoRefund: T.withdrawalConfirmedEmail(NAME, "Famille", "2 novembre 2026", null),
  weekly: T.weeklyReportEmail(NAME, [{ name: "Tom", exercises: 4, quizzes: 2, averageScore: 80, minutes: 35, courses: 1, badges: ["Série de 3"] }, { name: "Mia", exercises: 0, quizzes: 0, averageScore: null, minutes: 0, courses: 0, badges: [] }], "du 26 octobre au 1er novembre"),
  renewal: T.renewalReminderEmail(NAME, "Famille", "12 décembre 2026"),
  inactivity: T.inactivityWarningEmail(NAME, "12 décembre 2026"),
  childInactive: T.childInactiveEmail(NAME, "Tom", 5),
};

describe("e-mails : tous les gabarits", () => {
  for (const [key, mail] of Object.entries(samples)) {
    describe(key, () => {
      it("sujet, texte et HTML renseignés, sans valeur manquante", () => {
        expect(mail.subject.trim().length).toBeGreaterThan(3);
        expect(mail.textPart.trim().length).toBeGreaterThan(10);
        expect(mail.htmlPart).toContain("<html");
        for (const part of [mail.subject, mail.textPart, mail.htmlPart]) {
          expect(part).not.toMatch(/undefined|NaN|\[object|null\b/);
        }
        expect(mail.htmlPart + mail.textPart).toContain(NAME);
      });
      it("tous les liens sont absolus (https ou mailto)", () => {
        const hrefs = [...mail.htmlPart.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
        for (const h of hrefs) expect(h).toMatch(/^(https:\/\/|mailto:)/);
      });
    });
  }

  it("le bouton porte bien le lien fourni", () => {
    expect(samples.welcomePaid.htmlPart).toContain(URL_OK.replace(/&/g, "&amp;")); // tolère l'échappement
  });
  it("le code à 6 chiffres est dans le texte ET le HTML", () => {
    expect(samples.twoFactorCode.textPart).toContain("123456");
    expect(samples.twoFactorCode.htmlPart).toContain("123456");
  });
  it("un prénom malveillant est échappé dans le HTML", () => {
    const evil = T.welcomeEmail('<script>alert(1)</script>', URL_OK);
    expect(evil.htmlPart).not.toContain("<script>alert(1)</script>");
  });
});
