/** Types minimaux de l'API Web Speech (absente de lib.dom selon les versions de TypeScript). */
export interface SpeechResultAlternative { transcript: string }
export interface SpeechResultItem { isFinal: boolean; 0: SpeechResultAlternative; length: number }
export interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechResultItem> }
export interface SpeechRecognitionErrorLike { error?: string }
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous?: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Constructeur de reconnaissance vocale du navigateur, ou null s'il n'existe pas. */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
