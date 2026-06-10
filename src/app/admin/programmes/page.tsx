"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, FileText, CheckCircle, AlertTriangle, Loader2, BookOpen, X, GraduationCap, Download, Pencil, Save } from "lucide-react";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { supabase } from "@/lib/supabaseClient";
import AppAdminLoader from "@/components/AppAdminLoader";
import { useConfirm } from "@/components/ConfirmDialog";

interface ProgrammePdf {
  id: string;
  level: string;
  level_label: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
}

export default function AdminProgrammesPage() {
  const confirm = useConfirm();
  const [pdfs, setPdfs] = useState<ProgrammePdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(SCHOOL_LEVELS[9].value); // 2nde by default
  const [file, setFile] = useState<File | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editFileName, setEditFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showNotification = (type: "success" | "error", msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchPdfs = async () => {
    const res = await fetch("/api/admin/programmes");
    const json = await res.json();
    setPdfs(json.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPdfs(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { showNotification("error", "Sélectionne un fichier PDF."); return; }
    setUploading(true);
    try {
      const path = `${selectedLevel}/${Date.now()}_${file.name}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from("programmes")
        .upload(path, file, { upsert: true });
      if (storageError) throw new Error(storageError.message);

      const { data: urlData } = supabase.storage.from("programmes").getPublicUrl(storageData.path);
      const fileUrl = urlData.publicUrl;
      const levelLabel = SCHOOL_LEVELS.find(l => l.value === selectedLevel)?.label || selectedLevel;

      const res = await fetch("/api/admin/programmes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: selectedLevel,
          level_label: levelLabel,
          file_url: fileUrl,
          file_name: file.name,
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      showNotification("success", "Programme enregistré avec succès !");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      fetchPdfs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'upload.";
      showNotification("error", msg);
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (pdf: ProgrammePdf) => {
    setEditingId(pdf.id);
    setEditLabel(pdf.level_label || "");
    setEditFileName(pdf.file_name || "");
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/programmes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, level_label: editLabel, file_name: editFileName }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      showNotification("success", "Programme mis à jour !");
      setEditingId(null);
      fetchPdfs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la mise à jour.";
      showNotification("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (level: string) => {
    if (!(await confirm("Supprimer ce programme ?"))) return;
    await fetch("/api/admin/programmes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level }),
    });
    fetchPdfs();
  };

  if (loading) return <AppAdminLoader />;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl text-sm font-semibold transition-all ${notification.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {notification.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] flex items-center gap-3 mb-1">
          <GraduationCap className="text-[var(--greek-gold)]" size={30} />
          Programmes officiels
        </h1>
        <p className="text-[var(--greek-bronze)]">
          Dépose les PDFs officiels par niveau pour les rendre consultables sur la page publique des programmes.
        </p>
      </div>

      {/* Upload form */}
      <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-6 mb-8">
        <h2 className="font-bold text-[var(--greek-blue)] mb-5 font-[family-name:var(--font-display)]">
          Ajouter / Remplacer un programme
        </h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Niveau scolaire</label>
            <select
              value={selectedLevel}
              onChange={e => setSelectedLevel(e.target.value)}
              className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
            >
              {SCHOOL_LEVELS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Fichier PDF</label>
            <div
              className="border-2 border-dashed border-[rgba(197,161,72,0.35)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--greek-gold)] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText size={20} className="text-[var(--greek-blue)]" />
                  <span className="text-sm font-semibold text-[var(--greek-blue)]">{file.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                    <X size={16} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Clique pour sélectionner un PDF</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60"
              style={{ background: "var(--greek-blue)" }}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Upload en cours..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>

      {/* Liste des PDFs uploadés */}
      <div>
        <h2 className="font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)]">
          Programmes enregistrés ({pdfs.length})
        </h2>
        {pdfs.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)] text-sm bg-white rounded-2xl border border-[rgba(197,161,72,0.25)]">
            Aucun programme téléchargé pour l&apos;instant.
          </div>
        ) : (
          <div className="space-y-3">
            {pdfs.map(pdf => (
              <div key={pdf.id} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-4">
                {editingId === pdf.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--greek-blue)] mb-1">Titre / Niveau affiché</label>
                      <input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        className="w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--greek-blue)] mb-1">Nom du fichier</label>
                      <input
                        value={editFileName}
                        onChange={e => setEditFileName(e.target.value)}
                        className="w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[rgba(197,161,72,0.3)] text-[var(--text-muted)] hover:bg-gray-50">
                        Annuler
                      </button>
                      <button
                        onClick={() => saveEdit(pdf.id)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-white disabled:opacity-60"
                        style={{ background: "var(--greek-blue)" }}
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(197,161,72,0.1)" }}>
                        <BookOpen size={18} style={{ color: "var(--greek-gold)" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-[var(--greek-blue)] truncate">{pdf.level_label || pdf.level}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{pdf.file_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={pdf.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors hover:bg-gray-50"
                        style={{ borderColor: "rgba(197,161,72,0.3)", color: "var(--greek-blue)" }}
                      >
                        Voir le PDF
                      </a>
                      <a
                        href={pdf.file_url}
                        download={pdf.file_name}
                        className="p-2 rounded-lg text-[var(--greek-blue)] hover:bg-blue-50 transition-colors"
                        title="Télécharger"
                      >
                        <Download size={16} />
                      </a>
                      <button
                        onClick={() => startEdit(pdf)}
                        className="p-2 rounded-lg text-[var(--greek-blue)] hover:bg-blue-50 transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(pdf.level)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
