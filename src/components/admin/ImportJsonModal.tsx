"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileJson, Download, Sparkles } from "lucide-react";
import { downloadJSONTemplate } from "@/lib/jsonTemplates";

interface ImportJsonModalProps {
  onClose: () => void;
  onFileLoaded: (file: File) => void;
  label?: string;
  template?: object;
  templateFilename?: string;
}

export default function ImportJsonModal({ onClose, onFileLoaded, label = "fichier", template, templateFilename }: ImportJsonModalProps) {
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".json")) {
      alert("Le fichier doit être au format JSON.");
      return;
    }
    onFileLoaded(file);
    onClose();
  }, [onFileLoaded, onClose]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const SectionTitle = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-3 flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">{n}</span>
      {children}
    </h4>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1060] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero header */}
        <div
          className="px-8 py-6 text-white flex justify-between items-center relative overflow-hidden flex-shrink-0"
          style={{ background: "linear-gradient(to right, var(--greek-blue), #1e3a8a)" }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
              <FileJson className="text-[var(--greek-gold)]" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold font-[family-name:var(--font-display)] tracking-wide">
                Importer un {label}
              </h3>
              <p className="text-blue-100 text-sm opacity-90">
                Créez votre contenu en JSON ou importez un export Educalcul
              </p>
            </div>
          </div>
          <button onClick={onClose} className="group text-white/70 hover:text-white transition-colors p-2 relative z-10" aria-label="Fermer">
            <X size={22} className="transition-transform group-hover:scale-125" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Section 1: Télécharger le modèle */}
          {template && templateFilename && (
            <div className="p-6 border-b border-[rgba(197,161,72,0.25)]">
              <SectionTitle n={1}>Téléchargez le modèle</SectionTitle>
              <p className="text-sm text-gray-500 mb-3">
                Récupérez un fichier JSON vierge avec la structure attendue pour créer un {label} à la main.
              </p>
              <button
                type="button"
                onClick={() => downloadJSONTemplate(template, templateFilename)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-[var(--greek-blue)] border-2 border-[var(--greek-blue)]/20 rounded-xl text-sm font-bold hover:border-[var(--greek-blue)] hover:bg-blue-50 transition-colors"
              >
                <Download size={16} /> Télécharger le modèle JSON
              </button>
            </div>
          )}

          {/* Section 2: Remplir */}
          {template && templateFilename && (
            <div className="p-6 border-b border-[rgba(197,161,72,0.25)] bg-gray-50/50">
              <SectionTitle n={2}>Remplissez votre contenu</SectionTitle>
              <p className="text-sm text-gray-500 flex items-start gap-2">
                <Sparkles size={15} className="text-[var(--greek-gold)] flex-shrink-0 mt-0.5" />
                Éditez le fichier téléchargé (titre, description, chapitres/questions...) en respectant le format JSON, puis enregistrez-le.
              </p>
            </div>
          )}

          {/* Section 3 (or 1): Importer */}
          <div className="p-6">
            {template && templateFilename && <SectionTitle n={3}>Importez votre fichier</SectionTitle>}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all ${
                dragging
                  ? "border-[var(--greek-blue)] bg-blue-50 scale-[1.01]"
                  : "border-[rgba(197,161,72,0.4)] hover:border-[var(--greek-blue)] hover:bg-gray-50"
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${dragging ? "bg-[var(--greek-blue)]" : "bg-[var(--greek-blue)]/10"}`}>
                <Upload size={26} className={dragging ? "text-white" : "text-[var(--greek-blue)]"} />
              </div>

              <div className="text-center">
                <p className="font-semibold text-gray-700 text-sm">
                  {dragging ? "Relâchez pour importer" : "Glissez votre fichier JSON ici"}
                </p>
                {!dragging && <p className="text-xs text-gray-400 mt-1">ou</p>}
              </div>

              {!dragging && (
                <label className="cursor-pointer px-5 py-2.5 bg-[var(--greek-blue)] text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors shadow-sm">
                  Parcourir les fichiers
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </label>
              )}

              <p className="text-xs text-gray-400">Fichiers .json uniquement</p>
            </div>

            {/* Ornament */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="text-[var(--greek-gold)] text-xs">✦</span>
              <span className="text-xs text-gray-400">Format JSON exporté depuis Educalcul</span>
              <span className="text-[var(--greek-gold)] text-xs">✦</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
