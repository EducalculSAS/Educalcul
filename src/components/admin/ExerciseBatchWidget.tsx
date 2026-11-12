"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Layers, Loader2, X, AlertTriangle } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import ExerciseBatchModal from "@/components/admin/ExerciseBatchModal";

interface Summary { batchId: string; total: number; done: number; errors: number; active: number }

const HIDDEN_KEY = "edu-exercise-batch-hidden";
const readHidden = () => { try { return localStorage.getItem(HIDDEN_KEY); } catch { return null; } };

/**
 * Pastille unique d'un lot d'exercices (en haut à droite de l'admin, à côté des générations) : l'avancement du lot
 * entier au lieu d'une notification par exercice. Un clic ouvre la fenêtre du lot ; une fois le lot fini, on peut la
 * masquer. Le lot tourne sur le serveur, la pastille ne fait que lire son état.
 */
export default function ExerciseBatchWidget() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setHidden(readHidden());
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/ai/exercise/batch?summary=1");
        if (!res.ok) return;
        const data = (await res.json()) as Summary | null;
        if (alive) setSummary(data);
      } catch { /* réseau : prochain tour */ }
    };
    load();
    const timer = window.setInterval(load, 8_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  if (!summary) return null;
  const running = summary.active > 0;
  if (!running && hidden === summary.batchId) return open ? <ExerciseBatchModal initialBatchId={summary.batchId} onClose={() => setOpen(false)} /> : null;

  return (
    <>
      <div className="flex items-center gap-1">
        <GlassButton variant="outline" size="sm" onClick={() => setOpen(true)}>
          {running ? (
            <Loader2 size={16} className="animate-spin text-[var(--greek-gold)]" />
          ) : summary.errors ? (
            <AlertTriangle size={16} className="text-amber-500" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-500" />
          )}
          <Layers size={14} className="text-[var(--greek-blue)]" />
          {running ? `Lot d'exercices : ${summary.done}/${summary.total}` : `Lot terminé : ${summary.done}/${summary.total}`}
        </GlassButton>
        {!running && (
          <GlassIconButton
            icon={X}
            color="gray"
            size="sm"
            aria-label="Masquer"
            onClick={() => { try { localStorage.setItem(HIDDEN_KEY, summary.batchId); } catch { /* stockage indisponible */ } setHidden(summary.batchId); }}
          />
        )}
      </div>
      {open && <ExerciseBatchModal initialBatchId={summary.batchId} onClose={() => setOpen(false)} />}
    </>
  );
}
