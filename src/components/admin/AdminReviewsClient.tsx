"use client";

import { useState, useCallback } from "react";
import { Star, Plus, Trash2, Edit, GripVertical, Check } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { supabase } from "@/lib/supabaseClient";
import type { ManualReview } from "@/lib/manualReviews";
import type { ReviewRatingOverride } from "@/lib/reviewRatingOverride";

const inputCls = "w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

/** Même échelle de couleur que sur la page d'accueil (TrustScore Trustpilot). */
function ratingColor(rating: number): string {
  if (rating >= 4.5) return "#00b67a";
  if (rating >= 3.5) return "#73cf11";
  if (rating >= 2.5) return "#ffce00";
  if (rating >= 1.5) return "#ff8622";
  return "#ff3722";
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}

/** Avis clients affichés sur la page d'accueil : saisis manuellement (copiés
 * depuis Trustpilot ou toute autre source) plutôt que récupérés via une API
 * tierce payante et limitée en quota. */
export default function AdminReviewsClient({
  initialReviews,
  initialRatingOverride,
}: {
  initialReviews: ManualReview[];
  initialRatingOverride: ReviewRatingOverride;
}) {
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<ManualReview[]>(initialReviews);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManualReview | null>(null);
  const [saving, setSaving] = useState(false);

  const computedRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const [ratingEnabled, setRatingEnabled] = useState(initialRatingOverride.enabled);
  const [ratingValue, setRatingValue] = useState(initialRatingOverride.rating);
  const [ratingCount, setRatingCount] = useState(initialRatingOverride.count);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingSaved, setRatingSaved] = useState(false);

  const saveRatingOverride = async () => {
    setRatingSaving(true);
    setRatingSaved(false);
    try {
      await fetch(`/api/admin/review-rating`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({ enabled: ratingEnabled, rating: ratingValue, count: ratingCount }),
      });
      setRatingSaved(true);
      setTimeout(() => setRatingSaved(false), 2000);
    } finally {
      setRatingSaving(false);
    }
  };

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [isVerified, setIsVerified] = useState(true);
  const [country, setCountry] = useState("FR");
  const [publishedAt, setPublishedAt] = useState("");
  const [totalReviews, setTotalReviews] = useState(1);
  const [displayOrder, setDisplayOrder] = useState(0);

  const loadReviews = useCallback(async () => {
    const res = await fetch(`/api/admin/reviews`, { headers: await authHeaders() });
    const data = await res.json();
    setReviews(Array.isArray(data) ? data : []);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setTitle("");
    setReviewText("");
    setRating(5);
    setIsVerified(true);
    setCountry("FR");
    setPublishedAt(new Date().toISOString().slice(0, 10));
    setTotalReviews(1);
    setDisplayOrder(reviews.length);
    setModalOpen(true);
  };

  const openEdit = (r: ManualReview) => {
    setEditing(r);
    setName(r.name);
    setTitle(r.title || "");
    setReviewText(r.review_text);
    setRating(r.rating);
    setIsVerified(r.is_verified);
    setCountry(r.country || "");
    setPublishedAt(r.published_at || "");
    setTotalReviews(r.total_reviews);
    setDisplayOrder(r.display_order);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !reviewText.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        title: title.trim(),
        review_text: reviewText.trim(),
        rating,
        is_verified: isVerified,
        country: country.trim(),
        published_at: publishedAt || null,
        total_reviews: totalReviews,
        display_order: displayOrder,
      };
      if (editing) {
        await fetch(`/api/admin/reviews`, { method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ id: editing.id, ...body }) });
      } else {
        await fetch(`/api/admin/reviews`, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
      }
      await loadReviews();
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: ManualReview) => {
    const ok = await confirm(`L'avis de "${r.name}" sera supprimé de la page d'accueil.`, {
      title: "Supprimer l'avis ?",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/reviews`, { method: "DELETE", headers: await authHeaders(), body: JSON.stringify({ id: r.id }) });
    await loadReviews();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Star}
        title="Avis clients"
        subtitle="Avis affichés sur la page d'accueil, saisis manuellement (copiez le texte exact depuis Trustpilot ou une autre source)."
        actions={
          <GlassButton size="sm" variant="navy" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Nouvel avis
          </GlassButton>
        }
      />

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--greek-blue)] uppercase tracking-wide">Note globale affichée</h2>
          <p className="text-xs text-gray-500 mt-1">
            Par défaut, la note et le nombre d'avis affichés sur la page d'accueil sont calculés à partir des avis ci-dessous
            (actuellement {computedRating || "—"} / 5). Si ta vraie note Trustpilot est différente (ex. tu as 3,7/5 sur Trustpilot
            mais un seul avis à 5 étoiles ici), active la note manuelle pour afficher le vrai chiffre.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={ratingEnabled} onChange={e => setRatingEnabled(e.target.checked)} />
          Utiliser une note manuelle au lieu de la moyenne calculée
        </label>

        {ratingEnabled && (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className={labelCls}>Note (ex. 3.7)</label>
              <input type="number" min={0} max={5} step={0.1} value={ratingValue} onChange={e => setRatingValue(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nombre d'avis total</label>
              <input type="number" min={0} value={ratingCount} onChange={e => setRatingCount(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <GlassButton size="sm" variant="navy" onClick={saveRatingOverride} disabled={ratingSaving}>
            {ratingSaving ? "Enregistrement..." : "Enregistrer la note"}
          </GlassButton>
          {ratingSaved && <span className="text-xs font-semibold text-[#00b67a]"><Check className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" /> Enregistré</span>}
        </div>
      </div>

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Star className="w-10 h-10 mx-auto mb-2 opacity-20" aria-hidden="true" />
            <p className="text-sm">Aucun avis pour le moment.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3 w-10"></th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Note</th>
                <th className="text-left px-4 py-3">Extrait</th>
                <th className="text-left px-4 py-3">Vérifié</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} className="border-t border-[rgba(197,161,72,0.15)]">
                  <td className="px-4 py-3 text-gray-300"><GripVertical className="w-4 h-4" aria-hidden="true" /></td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const filled = i < r.rating;
                        const color = ratingColor(r.rating);
                        return (
                          <Star
                            key={i}
                            className={filled ? "w-3.5 h-3.5" : "w-3.5 h-3.5 text-gray-200"}
                            style={filled ? { fill: color, color } : undefined}
                          />
                        );
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.review_text}</td>
                  <td className="px-4 py-3">
                    {r.is_verified ? <span className="text-xs font-semibold text-[#00b67a]"><Check className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" /> Vérifié</span> : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <GlassIconButton icon={Edit} onClick={() => openEdit(r)} color="navy" size="sm" aria-label="Modifier l'avis" />
                      <GlassIconButton icon={Trash2} onClick={() => handleDelete(r)} color="red" size="sm" aria-label="Supprimer l'avis" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 modal-overlay">
          <div className="bg-white rounded-[20px] shadow-xl w-full max-w-lg p-6 border border-[rgba(197,161,72,0.25)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--greek-blue)]">
                {editing ? "Modifier l'avis" : "Nouvel avis"}
              </h3>
              <GlassCloseButton onClick={() => setModalOpen(false)} variant="light" />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nom du client</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Ex : Camille D." />
                </div>
                <div>
                  <label className={labelCls}>Pays (code)</label>
                  <input type="text" value={country} onChange={e => setCountry(e.target.value)} className={inputCls} placeholder="FR" maxLength={2} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Titre (optionnel)</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Ex : Super plateforme !" />
              </div>
              <div>
                <label className={labelCls}>Texte de l'avis</label>
                <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={4} className={inputCls} placeholder="Copiez le texte exact de l'avis..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Note (1 à 5)</label>
                  <select value={rating} onChange={e => setRating(Number(e.target.value))} className={inputCls}>
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} étoile{n > 1 ? "s" : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date de publication</label>
                  <input type="date" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nb d'avis du client (Trustpilot)</label>
                  <input type="number" min={1} value={totalReviews} onChange={e => setTotalReviews(Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ordre d'affichage</label>
                  <input type="number" min={0} value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} className={inputCls} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} />
                Avis vérifié (badge « Vérifié »)
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setModalOpen(false)}>
                  Annuler
                </GlassButton>
                <GlassButton size="sm" variant="navy" onClick={handleSave} disabled={saving || !name.trim() || !reviewText.trim()}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
