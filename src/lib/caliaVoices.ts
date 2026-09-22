/**
 * Voix disponibles pour « Calia en classe » (Azure Speech).
 *
 * Source unique : la route TTS, le profil de l'enfant et Calia elle-même
 * lisent cette liste. Elle sert aussi de LISTE BLANCHE — le nom de voix finit
 * dans le SSML envoyé à Azure, jamais une valeur fournie par le client telle
 * quelle (injection XML). La contrainte CHECK de `users.calia_voice` en base
 * reprend les mêmes identifiants : à garder alignée.
 */
export const CALIA_VOICES = [
  { id: "fr-FR-VivienneMultilingualNeural", label: "Vivienne", gender: "Female", description: "Douce et posée" },
  { id: "fr-FR-DeniseNeural", label: "Denise", gender: "Female", description: "Claire et dynamique" },
  { id: "fr-FR-HenriNeural", label: "Henri", gender: "Male", description: "Grave et calme" },
] as const;

export type CaliaVoiceId = (typeof CALIA_VOICES)[number]["id"];

export const DEFAULT_CALIA_VOICE: CaliaVoiceId = "fr-FR-VivienneMultilingualNeural";

export function isCaliaVoice(value: unknown): value is CaliaVoiceId {
  return typeof value === "string" && CALIA_VOICES.some((v) => v.id === value);
}

export function caliaVoiceGender(id: CaliaVoiceId): "Female" | "Male" {
  return CALIA_VOICES.find((v) => v.id === id)?.gender ?? "Female";
}
