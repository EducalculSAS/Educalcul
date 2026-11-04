import { getAudioContextCtor } from "@/lib/audioContext";
// Effets sonores generes a la volee (oscillateurs Web Audio) — pas de fichier
// audio a heberger/licencier, pas de nouvelle dependance npm.

interface Tone {
  freq: number;
  start: number;
  duration: number;
}

function playTones(tones: Tone[]) {
  try {
    const AudioCtx = getAudioContextCtor();
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    tones.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.15, t0 + 0.01);
      gain.gain.linearRampToValueAtTime(0, t0 + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    });
    const totalMs = (Math.max(...tones.map((t) => t.start + t.duration)) + 0.15) * 1000;
    setTimeout(() => ctx.close(), totalMs);
  } catch {
    // Web Audio indisponible — pas bloquant, pas de cue.
  }
}

/** "Blip" court façon Siri quand l'écoute démarre. */
export function playListeningCue() {
  playTones([
    { freq: 880, start: 0, duration: 0.09 },
    { freq: 1320, start: 0.09, duration: 0.09 },
  ]);
}

/** Carillon distinct à l'entrée en mode prof. */
export function playModeProfCue() {
  playTones([
    { freq: 660, start: 0, duration: 0.1 },
    { freq: 990, start: 0.1, duration: 0.1 },
    { freq: 1320, start: 0.2, duration: 0.14 },
  ]);
}
