"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileJson } from "lucide-react";

interface ImportJsonModalProps {
  onClose: () => void;
  onFileLoaded: (file: File) => void;
  label?: string;
}

export default function ImportJsonModal({ onClose, onFileLoaded, label = "fichier" }: ImportJsonModalProps) {
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white">
          <h3 className="font-bold font-[family-name:var(--font-display)] flex items-center gap-2 text-sm uppercase tracking-widest">
            <FileJson size={17} />
            Importer un {label}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <div className="p-6">
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
  );
}
