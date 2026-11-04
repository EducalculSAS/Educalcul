declare global {
  interface Window {
    /** Ancien nom de AudioContext (Safari avant 14.1), absent du typage standard du DOM. */
    webkitAudioContext?: typeof AudioContext;
  }
}

/** Constructeur de AudioContext, avec le repli `webkitAudioContext` des anciens Safari. */
export function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext || window.webkitAudioContext;
}
