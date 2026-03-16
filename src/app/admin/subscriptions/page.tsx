"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  X,
  Power,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_interval: "month" | "year" | "one_time";
  duration_months: number | null;
  trial_days: number | null;
  promo_description: string | null;
  features: any; // JSON
  is_active: boolean;
  created_at: string;
}

export default function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    billing_interval: "month",
    duration_months: "",
    trial_days: "",
    promo_description: "",
    is_active: true,
    // Features
    feature_max_children: 1,
    feature_access_level_exercises: "all",
    feature_detailed_reports: false,
    feature_priority_support: false,
    feature_offline_access: false,
    feature_custom_avatars: false,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/admin/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (plan: Plan | null = null) => {
    if (plan) {
      setEditingPlan(plan);
      const features =
        typeof plan.features === "string"
          ? JSON.parse(plan.features)
          : plan.features || {};
      setFormData({
        name: plan.name,
        description: plan.description || "",
        price: plan.price,
        billing_interval: plan.billing_interval as string,
        duration_months: plan.duration_months?.toString() || "",
        trial_days: plan.trial_days?.toString() || "",
        promo_description: plan.promo_description || "",
        is_active: plan.is_active,
        feature_max_children: features.max_children || 1,
        feature_access_level_exercises:
          features.access_level_exercises || "all",
        feature_detailed_reports: !!features.detailed_reports,
        feature_priority_support: !!features.priority_support,
        feature_offline_access: !!features.offline_access,
        feature_custom_avatars: !!features.custom_avatars,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: "",
        description: "",
        price: 0,
        billing_interval: "month",
        duration_months: "",
        trial_days: "",
        promo_description: "",
        is_active: true,
        feature_max_children: 1,
        feature_access_level_exercises: "all",
        feature_detailed_reports: false,
        feature_priority_support: false,
        feature_offline_access: false,
        feature_custom_avatars: false,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPlan(null);
    setMessage(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const features = {
      max_children: Number(formData.feature_max_children),
      access_level_exercises: formData.feature_access_level_exercises,
      detailed_reports: formData.feature_detailed_reports,
      priority_support: formData.feature_priority_support,
      offline_access: formData.feature_offline_access,
      custom_avatars: formData.feature_custom_avatars,
    };

    const payload = {
      name: formData.name,
      description: formData.description,
      price: Number(formData.price),
      billing_interval: formData.billing_interval,
      duration_months: formData.duration_months
        ? Number(formData.duration_months)
        : null,
      trial_days: formData.trial_days ? Number(formData.trial_days) : null,
      promo_description: formData.promo_description,
      is_active: formData.is_active,
      features,
    };

    try {
      const url = "/api/admin/subscriptions";
      const method = editingPlan ? "PUT" : "POST";
      const body = editingPlan
        ? JSON.stringify({ ...payload, id: editingPlan.id })
        : JSON.stringify(payload);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      const result = await res.json();

      if (!res.ok)
        throw new Error(result.error || "Erreur lors de la sauvegarde");

      handleCloseModal();
      fetchPlans();
      setMessage({
        type: "success",
        text: editingPlan
          ? "Plan modifié avec succès"
          : "Plan ajouté avec succès",
      });
    } catch (error: any) {
      console.error("Error saving plan:", error);
      alert(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce plan ?")) return;

    try {
      const res = await fetch(`/api/admin/subscriptions?id=${id}`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (!res.ok)
        throw new Error(result.error || "Erreur lors de la suppression");

      fetchPlans();
      setMessage({ type: "success", text: "Plan supprimé avec succès" });
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      alert(error.message);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, is_active: !plan.is_active }),
      });

      if (!res.ok) throw new Error("Erreur lors de la mise à jour");

      fetchPlans();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden mb-8">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <CreditCard className="text-[var(--greek-gold)]" size={32} />
              Plans d'Abonnement
            </h1>
            <p className="text-[var(--greek-bronze)] text-lg">
              Gérez les offres d'abonnement disponibles pour les utilisateurs
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/10"
          >
            <Plus size={20} />
            Nouveau Plan
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-[20px] flex items-center shadow-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle size={20} className="mr-3" />
          ) : (
            <AlertTriangle size={20} className="mr-3" />
          )}
          {message.text}
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-[20px] shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${
              plan.is_active ? "border-gray-100" : "border-gray-100 opacity-75"
            }`}
          >
            <div
              className={`px-6 py-4 border-b flex justify-between items-center ${
                plan.is_active ? "bg-gray-50" : "bg-gray-50"
              }`}
            >
              <h3 className="font-bold text-lg text-[var(--greek-blue)]">
                {plan.name}
              </h3>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                  plan.is_active
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                {plan.is_active ? "Actif" : "Inactif"}
              </span>
            </div>
            <div className="p-6">
              <div className="flex items-baseline mb-4">
                <span className="text-3xl font-bold text-[var(--greek-blue)]">
                  {plan.price}€
                </span>
                <span className="text-[var(--greek-bronze)] ml-1">
                  /
                  {plan.billing_interval === "month"
                    ? "mois"
                    : plan.billing_interval === "year"
                    ? "an"
                    : "unique"}
                </span>
              </div>

              <p className="text-gray-600 mb-4 h-12 overflow-hidden text-sm">
                {plan.description}
              </p>

              <div className="space-y-2 mb-6 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
                {plan.trial_days ? (
                  <div className="flex items-center text-green-600 font-medium">
                    <Clock size={16} className="mr-2" />
                    {plan.trial_days} jours d'essai gratuit
                  </div>
                ) : null}
                {plan.duration_months ? (
                  <div className="flex items-center">
                    <Calendar size={16} className="mr-2" />
                    Durée: {plan.duration_months} mois
                  </div>
                ) : null}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleToggleActive(plan)}
                  className={`text-sm font-medium flex items-center gap-1 ${
                    plan.is_active
                      ? "text-orange-600 hover:text-orange-800"
                      : "text-green-600 hover:text-green-800"
                  }`}
                >
                  <Power size={14} />
                  {plan.is_active ? "Désactiver" : "Activer"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(plan)}
                    className="p-2 text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                {editingPlan ? "Modifier le Plan" : "Nouveau Plan"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nom du Plan
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all"
                    placeholder="ex: Premium Mensuel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Prix (€)
                  </label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Facturation
                  </label>
                  <select
                    name="billing_interval"
                    value={formData.billing_interval}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all bg-white"
                  >
                    <option value="month">Mensuel</option>
                    <option value="year">Annuel</option>
                    <option value="one_time">Paiement unique</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all resize-none"
                    placeholder="Description courte visible par les utilisateurs"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Durée (Mois)
                  </label>
                  <input
                    type="number"
                    name="duration_months"
                    min="1"
                    value={formData.duration_months}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all"
                    placeholder="Optionnel (illimité si vide)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Essai Gratuit (Jours)
                  </label>
                  <input
                    type="number"
                    name="trial_days"
                    min="0"
                    value={formData.trial_days}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all"
                    placeholder="Optionnel"
                  />
                </div>

                <div className="col-span-2 border-t border-gray-100 pt-6 mt-2">
                  <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                    <CheckCircle
                      size={20}
                      className="text-[var(--greek-gold)]"
                    />
                    Fonctionnalités
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Max Enfants
                      </label>
                      <input
                        type="number"
                        name="feature_max_children"
                        min="1"
                        value={formData.feature_max_children}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Niveau Accès
                      </label>
                      <select
                        name="feature_access_level_exercises"
                        value={formData.feature_access_level_exercises}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all bg-white"
                      >
                        <option value="basic">Basique</option>
                        <option value="intermediate">Intermédiaire</option>
                        <option value="advanced">Avancé</option>
                        <option value="all">Tout</option>
                      </select>
                    </div>

                    <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div className="flex items-center p-3 rounded-xl border border-gray-200 hover:border-[var(--greek-blue)] transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          id="feature_detailed_reports"
                          name="feature_detailed_reports"
                          checked={formData.feature_detailed_reports}
                          onChange={handleInputChange}
                          className="h-5 w-5 text-[var(--greek-blue)] focus:ring-[var(--greek-blue)] border-gray-300 rounded"
                        />
                        <label
                          htmlFor="feature_detailed_reports"
                          className="ml-3 block text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Rapports Détaillés
                        </label>
                      </div>
                      <div className="flex items-center p-3 rounded-xl border border-gray-200 hover:border-[var(--greek-blue)] transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          id="feature_priority_support"
                          name="feature_priority_support"
                          checked={formData.feature_priority_support}
                          onChange={handleInputChange}
                          className="h-5 w-5 text-[var(--greek-blue)] focus:ring-[var(--greek-blue)] border-gray-300 rounded"
                        />
                        <label
                          htmlFor="feature_priority_support"
                          className="ml-3 block text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Support Prioritaire
                        </label>
                      </div>
                      <div className="flex items-center p-3 rounded-xl border border-gray-200 hover:border-[var(--greek-blue)] transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          id="feature_offline_access"
                          name="feature_offline_access"
                          checked={formData.feature_offline_access}
                          onChange={handleInputChange}
                          className="h-5 w-5 text-[var(--greek-blue)] focus:ring-[var(--greek-blue)] border-gray-300 rounded"
                        />
                        <label
                          htmlFor="feature_offline_access"
                          className="ml-3 block text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Accès Hors-ligne
                        </label>
                      </div>
                      <div className="flex items-center p-3 rounded-xl border border-gray-200 hover:border-[var(--greek-blue)] transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          id="feature_custom_avatars"
                          name="feature_custom_avatars"
                          checked={formData.feature_custom_avatars}
                          onChange={handleInputChange}
                          className="h-5 w-5 text-[var(--greek-blue)] focus:ring-[var(--greek-blue)] border-gray-300 rounded"
                        />
                        <label
                          htmlFor="feature_custom_avatars"
                          className="ml-3 block text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Avatars Personnalisés
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 flex items-center mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="is_active"
                    className="ml-3 block text-sm font-bold text-gray-700"
                  >
                    Plan Actif (visible pour les utilisateurs)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/10"
                >
                  {editingPlan ? "Mettre à jour" : "Créer le Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
