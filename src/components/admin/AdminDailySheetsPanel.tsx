"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save, Lock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLoaderDots from "@/components/AdminLoaderDots";
import GlassButton from "@/components/ui/GlassButton";
import { RULES_BY_GAME_TYPE, GAME_TYPES, type MinigameType, type AnswerType } from "@/lib/minigames/gameTypes";

type Question = { prompt: string; answer: number | string };
type Sheet = {
  id: string;
  palier_code: string;
  tier: "free" | "premium";
  questions: Question[];
  status: string;
  is_archived: boolean;
  language?: string | null;
};

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}` };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function TierCard({ gameType, answerType, palierCode, tier, sheet, date, onChanged }: {
  gameType: MinigameType;
  answerType: AnswerType;
  palierCode: string;
  tier: "free" | "premium";
  sheet: Sheet | undefined;
  date: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Question[] | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = editing ?? sheet?.questions ?? [];
  const dirty = editing !== null;

  const startEdit = () => setEditing(sheet?.questions ? sheet.questions.map((q) => ({ ...q })) : []);
  const updateQuestion = (i: number, patch: Partial<Question>) => {
    setEditing((prev) => (prev ? prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) : prev));
  };

  const save = async () => {
    if (!sheet || !editing) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/minigames/daily-sheets/${sheet.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ questions: editing }),
      });
      if (res.ok) {
        setEditing(null);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/minigames/daily-sheets", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ gameType, palierCode, date, tier }),
      });
      if (res.ok) {
        setEditing(null);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-xl p-3" style={{ borderColor: "rgba(15,30,58,0.1)" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: tier === "premium" ? "var(--greek-gold)" : "var(--greek-blue)" }}>
          {tier === "premium" && <Lock className="w-3 h-3" />}
          {tier === "premium" ? "Bonus premium" : "Standard"}
          {sheet?.language && <span className="normal-case font-normal text-gray-400">({sheet.language})</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {dirty && (
            <GlassButton size="sm" variant="gold" disabled={busy} onClick={save}>
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </GlassButton>
          )}
          <GlassButton size="sm" variant="ghost" disabled={busy} onClick={regenerate}>
            <RefreshCw className="w-3.5 h-3.5" /> {sheet ? "Régénérer" : "Générer"}
          </GlassButton>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Pas encore généré pour ce jour.</p>
      ) : (
        <div className="space-y-1.5">
          {questions.map((q, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={q.prompt}
                onChange={(e) => { if (!dirty) startEdit(); updateQuestion(i, { prompt: e.target.value }); }}
                className="flex-1 text-xs border rounded-lg px-2 py-1"
                style={{ borderColor: "rgba(15,30,58,0.12)" }}
              />
              <input
                type={answerType === "number" ? "number" : "text"}
                value={q.answer}
                onChange={(e) => {
                  if (!dirty) startEdit();
                  updateQuestion(i, { answer: answerType === "number" ? Number(e.target.value) : e.target.value });
                }}
                className="w-20 text-xs border rounded-lg px-2 py-1 font-bold"
                style={{ borderColor: "rgba(15,30,58,0.12)", color: "var(--greek-gold)" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDailySheetsPanel({ gameType }: { gameType: MinigameType }) {
  const [date, setDate] = useState(todayStr());
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/minigames/daily-sheets?date=${date}&gameType=${gameType}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setSheets(data.sheets || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, gameType]);

  const byPalier = (code: string) => ({
    free: sheets.find((s) => s.palier_code === code && s.tier === "free"),
    premium: sheets.find((s) => s.palier_code === code && s.tier === "premium"),
  });

  const rules = RULES_BY_GAME_TYPE[gameType];
  const answerType = GAME_TYPES[gameType].answerType;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          Contenu du jour par palier — généré automatiquement chaque nuit, modifiable ici si besoin.
        </p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border rounded-lg px-2 py-1.5"
          style={{ borderColor: "rgba(15,30,58,0.15)" }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><AdminLoaderDots /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rules.map((rule) => {
            const { free, premium } = byPalier(rule.code);
            return (
              <div key={rule.code} className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-4">
                <h3 className="font-bold text-[var(--greek-blue)] mb-3">{rule.label}</h3>
                <div className="space-y-3">
                  <TierCard gameType={gameType} answerType={answerType} palierCode={rule.code} tier="free" sheet={free} date={date} onChanged={load} />
                  <TierCard gameType={gameType} answerType={answerType} palierCode={rule.code} tier="premium" sheet={premium} date={date} onChanged={load} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
