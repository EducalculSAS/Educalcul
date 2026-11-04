import { useCallback, useRef } from "react";
import { getAudioContextCtor } from "@/lib/audioContext";

/**
 * Barge-in par volume : détecte qu'un son fort arrive sur le micro, indépendamment de la reconnaissance vocale (qui a un
 * temps de latence avant de produire le moindre texte — attendre du texte rendait l'interruption trop lente/peu fiable).
 */
const VOLUME_BARGE_IN_THRESHOLD = 35; // 0-255, à affiner selon retours réels

export function useMicVolumeMonitor() {
  const micStreamRef = useRef<MediaStream | null>(null);
  const volumeAudioCtxRef = useRef<AudioContext | null>(null);
  const volumeRafRef = useRef<number>(0);

  const stopVolumeMonitor = useCallback(() => {
    cancelAnimationFrame(volumeRafRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    volumeAudioCtxRef.current?.close().catch(() => {});
    volumeAudioCtxRef.current = null;
  }, []);

  /** Garde le flux micro et appelle `onLoud` à chaque image où le volume dépasse le seuil. */
  const startVolumeMonitor = (stream: MediaStream, onLoud: () => void) => {
    micStreamRef.current = stream;
    const AudioCtx = getAudioContextCtor();
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    volumeAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      if (sum / data.length > VOLUME_BARGE_IN_THRESHOLD) onLoud();
      volumeRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  return { startVolumeMonitor, stopVolumeMonitor };
}
