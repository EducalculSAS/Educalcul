// Types d'événements du calendrier scolaire — labels, couleurs et icônes

export type CalendarEventType =
  | "controle"
  | "devoir"
  | "revision"
  | "vacances"
  | "abonnement"
  | "paiement"
  | "event";

export interface EventTypeMeta {
  label: string;
  color: string; // couleur de fond pour les puces/badges
  textColor: string;
}

export const EVENT_TYPE_META: Record<CalendarEventType, EventTypeMeta> = {
  controle: { label: "Contrôle", color: "#dc2626", textColor: "#ffffff" },
  devoir: { label: "Devoir", color: "var(--greek-bronze)", textColor: "#ffffff" },
  revision: { label: "Révision", color: "var(--greek-gold)", textColor: "var(--greek-blue)" },
  vacances: { label: "Vacances", color: "#16a34a", textColor: "#ffffff" },
  abonnement: { label: "Abonnement", color: "var(--greek-blue)", textColor: "#ffffff" },
  paiement: { label: "Paiement", color: "#7c3aed", textColor: "#ffffff" },
  event: { label: "Événement", color: "#64748b", textColor: "#ffffff" },
};

export const EVENT_TYPE_OPTIONS: { value: CalendarEventType; label: string }[] = [
  { value: "event", label: "Événement" },
  { value: "controle", label: "Contrôle" },
  { value: "devoir", label: "Devoir" },
  { value: "revision", label: "Révision" },
];

export const PARENT_ONLY_EVENT_TYPE_OPTIONS: { value: CalendarEventType; label: string }[] = [
  ...EVENT_TYPE_OPTIONS,
  { value: "abonnement", label: "Abonnement" },
  { value: "paiement", label: "Paiement" },
];

export function getEventTypeMeta(type: string): EventTypeMeta {
  return EVENT_TYPE_META[type as CalendarEventType] || EVENT_TYPE_META.event;
}
