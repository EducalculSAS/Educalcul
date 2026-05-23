"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Send, CheckCircle, AlertCircle, Mail, Clock, MessageSquare } from "lucide-react";
import { useState } from "react";

const SUBJECTS = [
  "Question sur les abonnements",
  "Problème technique",
  "Problème de compte",
  "Question pédagogique",
  "Demande de partenariat",
  "Signaler un contenu",
  "Suggestion d'amélioration",
  "Autre",
];

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", subjectType: "", customSubject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      if (!formData.name || !formData.email || !formData.subjectType || !formData.message) throw new Error("Tous les champs sont obligatoires.");
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
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Une erreur est survenue.");
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm border border-[var(--greek-border)] bg-white text-[var(--text-dark)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)] transition-colors";

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow pt-[64px]">

        {/* HERO */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-24 text-center">
          {[{s:"∑",x:6,y:10,z:96,d:0,t:7.2},{s:"π",x:87,y:7,z:72,d:1.3,t:8.5},{s:"√",x:12,y:62,z:58,d:0.6,t:9.1},{s:"∫",x:91,y:48,z:104,d:2.1,t:7.4},{s:"Δ",x:43,y:14,z:50,d:0.9,t:10.2},{s:"∞",x:65,y:70,z:66,d:1.8,t:8.0},{s:"α",x:2,y:40,z:44,d:2.7,t:9.3},{s:"×",x:76,y:26,z:54,d:0.4,t:7.8},{s:"θ",x:50,y:78,z:62,d:2.0,t:8.8},{s:"β",x:28,y:53,z:42,d:3.3,t:10.5},{s:"≠",x:58,y:30,z:46,d:1.1,t:9.7},{s:"÷",x:19,y:84,z:38,d:2.9,t:7.3}].map((cfg,i)=>(
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none" style={{left:`${cfg.x}%`,top:`${cfg.y}%`,fontSize:`${cfg.z}px`,fontFamily:"Georgia,serif",color:"var(--greek-gold)",opacity:0.13,animationDuration:`${cfg.t}s`,animationDelay:`${cfg.d}s`}}>{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-3xl">
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl font-bold mb-5">Contactez-nous</h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">
              Notre équipe est disponible pour répondre à toutes vos questions. Nous vous répondons sous 24h.
            </p>
          </div>
        </section>

        {/* CONTENT */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

              {/* Infos */}
              <div className="space-y-6">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] mb-6">Comment pouvons-nous vous aider ?</h2>
                </div>
                {[
                  { icon: <Mail className="w-5 h-5 text-[var(--greek-gold)]" />, title: "Email", desc: "educalcul@gmail.com" },
                  { icon: <Clock className="w-5 h-5 text-[var(--greek-gold)]" />, title: "Délai de réponse", desc: "Moins de 24h en semaine" },
                  { icon: <MessageSquare className="w-5 h-5 text-[var(--greek-gold)]" />, title: "Support", desc: "Du lundi au vendredi" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 bg-white rounded-xl border border-[var(--greek-border)]">
                    <div className="w-10 h-10 rounded-xl bg-[var(--greek-cream)] flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[var(--greek-blue)]">{item.title}</p>
                      <p className="text-sm text-[var(--text-muted)] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulaire */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl p-8 border border-[var(--greek-border)] shadow-sm">
                  {status === "success" ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] mb-2">Message envoyé</h3>
                      <p className="text-[var(--text-muted)] text-sm">Nous vous répondrons dans les plus brefs délais.</p>
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
                          <label className="block text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Nom complet</label>
                          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Marie Dupont" required className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Adresse email</label>
                          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="marie@exemple.fr" required className={inputClass} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Sujet</label>
                        <select name="subjectType" value={formData.subjectType} onChange={handleChange} required className={inputClass}>
                          <option value="">Sélectionnez un sujet</option>
                          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      {formData.subjectType === "Autre" && (
                        <div>
                          <label className="block text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Précisez le sujet</label>
                          <input type="text" name="customSubject" value={formData.customSubject} onChange={handleChange} placeholder="Décrivez brièvement votre sujet" className={inputClass} />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-[var(--greek-blue)] mb-1.5 uppercase tracking-wide">Message</label>
                        <textarea name="message" value={formData.message} onChange={handleChange} rows={5} placeholder="Décrivez votre demande en détail..." required
                          className={inputClass + " resize-none"} />
                      </div>

                      <button type="submit" disabled={status === "loading"}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-[var(--greek-blue)] text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all shadow-md disabled:opacity-50">
                        {status === "loading" ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi en cours...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Envoyer le message</>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
