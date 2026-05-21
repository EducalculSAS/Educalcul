"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, User, Send, MessageSquare, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subjectType: "",
    customSubject: "",
    message: ""
  });

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      if (!formData.name || !formData.email || !formData.subjectType || !formData.message) {
        throw new Error("Tous les champs sont obligatoires.");
      }
      const subject = formData.subjectType === "Autre" ? (formData.customSubject || "Autre") : formData.subjectType;

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, email: formData.email, subject, message: formData.message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi.");

      setStatus('success');
      setFormData({ name: "", email: "", subjectType: "", customSubject: "", message: "" });
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || "Une erreur est survenue.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[64px]">
        {/* Hero Section */}
        <section className="bg-[var(--greek-cream)] py-16 text-center relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl mb-4 flex items-center justify-center gap-3">
                <Mail className="w-10 h-10 md:w-12 md:h-12 text-[var(--greek-gold)]" />
                Contactez-nous
              </h1>
              <p className="text-[var(--greek-blue)] text-xl opacity-80">
                Nous sommes là pour vous aider ! N'hésitez pas à nous contacter
              </p>
            </div>
          </div>
        </section>

        {/* Contact Form Section */}
        <section className="pb-20">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              
              {/* Status Messages */}
              {status === 'success' && (
                <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  <p className="text-green-700">Votre message a été envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.</p>
                </div>
              )}

              {status === 'error' && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-red-700">{errorMessage}</p>
                </div>
              )}

              <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[var(--greek-gold)] p-8">
                <h3 className="text-center text-2xl font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] mb-8 flex items-center justify-center gap-2">
                  <Send className="w-6 h-6 text-[var(--greek-gold)]" />
                  Envoyez-nous un message
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">Nom complet</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]"
                          placeholder="Votre nom"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">Adresse email</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]"
                          placeholder="votre@email.com"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subjectType" className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">Type de demande</label>
                    <div className="relative">
                      <select
                        id="subjectType"
                        name="subjectType"
                        value={formData.subjectType}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)] bg-white appearance-none"
                        required
                      >
                        <option value="">Sélectionnez un sujet</option>
                        <option value="Question sur les abonnements">Question sur les abonnements</option>
                        <option value="Problème technique">Problème technique</option>
                        <option value="Problème de compte">Problème de compte</option>
                        <option value="Question pédagogique">Question pédagogique</option>
                        <option value="Demande de partenariat">Demande de partenariat</option>
                        <option value="Signaler un contenu">Signaler un contenu</option>
                        <option value="Suggestion d'amélioration">Suggestion d'amélioration</option>
                        <option value="Autre">Autre</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>

                  {formData.subjectType === "Autre" && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <label htmlFor="customSubject" className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">Précisez votre sujet</label>
                      <input
                        type="text"
                        id="customSubject"
                        name="customSubject"
                        value={formData.customSubject}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]"
                        placeholder="Décrivez brièvement votre demande"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="message" className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">Message</label>
                    <div className="relative">
                      <div className="absolute top-3 left-3 pointer-events-none">
                        <MessageSquare className="h-5 w-5 text-gray-400" />
                      </div>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={6}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]"
                        placeholder="Comment pouvons-nous vous aider ?"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="btn-primary-greek w-full flex items-center justify-center gap-2"
                  >
                    {status === 'loading' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Envoyer le message
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
