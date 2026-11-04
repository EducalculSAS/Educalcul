"use client";

import { Send, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { SUBJECTS } from "@/lib/contactSubjects";
import GlassButton from "@/components/ui/GlassButton";

const inputClass = "w-full px-4 py-3 rounded-xl text-sm border border-gray-200 bg-white text-[var(--text-dark)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)] transition-colors";

/** Formulaire de contact : seule partie réellement interactive de /contact,
 * isolée en client island. Le reste de la page (hero, cartes info) est rendu
 * côté serveur. */
export default function ContactForm() {
  const [formData, setFormData] = useState({ name: "", email: "", subjectType: "", customSubject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setStatus("loading");
    try {
      if (!formData.name || !formData.email || !formData.subjectType || !formData.message)
        throw new Error("Tous les champs sont obligatoires.");
      const subject = formData.subjectType === "Autre" ? (formData.customSubject || "Autre") : formData.subjectType;
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, email: formData.email, subject, message: formData.message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi.");
      setStatus("success");
      setFormData({ name: "", email: "", subjectType: "", customSubject: "", message: "" });
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
      {status === "success" ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] mb-2">Message envoyé</h3>
          <p className="text-[var(--text-muted)] text-sm">Nous vous répondrons dans les plus brefs délais.</p>
          <div className="mt-6">
            <GlassButton onClick={() => setStatus("idle")} variant="outline" size="sm">Envoyer un autre message</GlassButton>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {status === "error" && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Nom complet</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Marie Dupont" required className={inputClass} />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Adresse email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="marie@exemple.fr" required className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Sujet</label>
            <select name="subjectType" aria-label="Sujet" value={formData.subjectType} onChange={handleChange} required className={inputClass}>
              <option value="">Sélectionnez un sujet</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {formData.subjectType === "Autre" && (
            <div>
              <label className="block font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Précisez le sujet</label>
              <input type="text" name="customSubject" value={formData.customSubject} onChange={handleChange}
                placeholder="Décrivez brièvement votre sujet" className={inputClass} />
            </div>
          )}

          <div>
            <label className="block font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Message</label>
            <textarea name="message" value={formData.message} onChange={handleChange} rows={5}
              placeholder="Décrivez votre demande en détail..." required
              className={inputClass + " resize-none"} />
          </div>

          <GlassButton
            type="submit"
            variant="navy"
            fullWidth
            disabled={status === "loading"}
          >
            {status === "loading" ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi en cours...</>
            ) : (
              <><Send className="w-4 h-4" /> Envoyer le message</>
            )}
          </GlassButton>
        </form>
      )}
    </div>
  );
}
