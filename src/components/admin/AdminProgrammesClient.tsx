"use client";

import { useState, useRef } from "react";
import { Upload, Trash2, FileText, CheckCircle, AlertTriangle, Loader2, BookOpen, X, GraduationCap, Download, Pencil, Save } from "lucide-react";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

interface ProgrammePdf {
  id: string;
  level: string;
  level_label: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
}

/** Programmes officiels (PDFs par niveau) : la liste initiale arrive déjà
 * chargée du serveur ; upload/édition/suppression restent des allers-retours
 * client, comme avant. */
export default function AdminProgrammesClient({ initialPdfs }: { initialPdfs: ProgrammePdf[] }) {
  const confirm = useConfirm();
  const [pdfs, setPdfs] = useState<ProgrammePdf[]>(initialPdfs);
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
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { showNotification("error", "Sélectionne un fichier PDF."); return; }
    setUploading(true);
    try {
      const levelLabel = SCHOOL_LEVELS.find(l => l.value === selectedLevel)?.label || selectedLevel;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("level", selectedLevel);
      fd.append("level_label", levelLabel);

      const res = await fetch("/api/admin/programmes", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Erreur serveur");
      }
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

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl text-sm font-semibold transition-all ${notification.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {notification.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {notification.msg}
        </div>
      )}

      <AdminPageHeader
        icon={GraduationCap}
        title="Programmes officiels"
        subtitle="Dépose les PDFs officiels par niveau pour les rendre consultables sur la page publique des programmes."
      />

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
                  <span onClick={e => e.stopPropagation()}>
                    <GlassIconButton
                      icon={X}
                      color="red"
                      size="sm"
                      aria-label="Supprimer le fichier"
                      onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    />
                  </span>
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
            <GlassButton
              variant="navy"
              disabled={uploading || !file}
              onClick={() => handleUpload({ preventDefault: () => {} } as unknown as React.FormEvent)}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Upload en cours..." : "Enregistrer"}
            </GlassButton>
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
                      <GlassButton size="sm" variant="ghost" onClick={cancelEdit}>
                        Annuler
                      </GlassButton>
                      <GlassButton
                        size="sm"
                        variant="navy"
                        disabled={saving}
                        onClick={() => saveEdit(pdf.id)}
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Enregistrer
                      </GlassButton>
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
                      <GlassButton
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(pdf.file_url, "_blank", "noopener,noreferrer")}
                      >
                        Voir le PDF
                      </GlassButton>
                      <GlassIconButton
                        icon={Download}
                        color="gold"
                        size="sm"
                        aria-label="Télécharger le programme"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = pdf.file_url;
                          a.download = pdf.file_name;
                          a.click();
                        }}
                      />
                      <GlassIconButton
                        icon={Pencil}
                        color="navy"
                        size="sm"
                        aria-label="Modifier le programme"
                        onClick={() => startEdit(pdf)}
                      />
                      <GlassIconButton
                        icon={Trash2}
                        color="red"
                        size="sm"
                        aria-label="Supprimer le programme"
                        onClick={() => handleDelete(pdf.level)}
                      />
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
