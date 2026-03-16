"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import {
  Users,
  Search,
  Filter,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  User as UserIcon,
  Baby,
  Globe,
  MapPin,
  Clock,
  Laptop,
} from "lucide-react";

interface User {
  id: string;
  auth_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "admin" | "parent" | "child";
  status: "active" | "inactive" | "pending";
  created_at: string;
  grade_level?: string;
  child_age?: number;
  password_hash?: string;
  last_login_ip?: string;
  last_login_city?: string;
  last_login_country?: string;
  latitude?: number;
  longitude?: number;
  last_active_at?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const UserMap = useMemo(() => dynamic(
    () => import("@/components/admin/UserMap"),
    { 
      ssr: false,
      loading: () => <div className="h-full w-full bg-gray-50 animate-pulse flex items-center justify-center text-gray-400">Chargement de la carte...</div>
    }
  ), []);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authDetails, setAuthDetails] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "parent",
    status: "active",
    gradeLevel: "",
    childAge: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  // Geocoding for current user if missing
  useEffect(() => {
    const updateMyLocation = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if we already have geo data
        const { data: userData } = await supabase
          .from("users")
          .select("latitude, longitude")
          .eq("auth_id", user.id)
          .single();

        if (userData && !userData.latitude) {
          // Fetch location by IP
          const res = await fetch("https://ipapi.co/json/");
          const geo = await res.json();
          
          if (geo.latitude && geo.longitude) {
            await supabase
              .from("users")
              .update({
                latitude: geo.latitude,
                longitude: geo.longitude,
                last_login_city: geo.city,
                last_login_country: geo.country_name,
                last_login_ip: geo.ip
              })
              .eq("auth_id", user.id);
            
            // Refresh users list to show me on the map
            fetchUsers();
          }
        }
      } catch (err) {
        console.error("Auto-geocoding failed:", err);
      }
    };

    if (!loading) {
      updateMyLocation();
    }
  }, [loading]);

  // Real-time Presence
  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: 'user',
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const onlineIds = new Set<string>();
        
        Object.values(newState).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.auth_id) onlineIds.add(p.auth_id);
          });
        });
        
        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({
              auth_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = "/api/admin/users?";
      if (roleFilter !== "all") url += `&role=${roleFilter}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch users");
      }

      setUsers(data as User[]);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.first_name?.toLowerCase() || "").includes(searchLower) ||
      (user.last_name?.toLowerCase() || "").includes(searchLower) ||
      (user.email?.toLowerCase() || "").includes(searchLower)
    );
  });

  const handleOpenModal = async (mode: "create" | "edit", user?: User) => {
    setModalMode(mode);
    setAuthDetails(null);
    if (mode === "edit" && user) {
      setCurrentUser(user);
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        password: "", // Don't show password
        role: user.role || "parent",
        status: user.status || "active",
        gradeLevel: user.grade_level || "",
        childAge: user.child_age?.toString() || "",
      });

      // Fetch Auth details for admins
      setLoadingAuth(true);
      try {
        const res = await fetch(`/api/admin/users/auth-info?id=${user.auth_id}`);
        if (res.ok) {
          const data = await res.json();
          setAuthDetails(data);
        }
      } catch (err) {
        console.error("Error fetching auth details:", err);
      } finally {
        setLoadingAuth(false);
      }
    } else {
      setCurrentUser(null);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "parent",
        status: "active",
        gradeLevel: "",
        childAge: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = "/api/admin/users";
      const method = modalMode === "create" ? "POST" : "PUT";

      const body: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        gradeLevel: formData.gradeLevel,
        childAge: formData.childAge,
      };

      if (formData.password) {
        body.password = formData.password;
      }

      if (modalMode === "edit" && currentUser) {
        body.id = currentUser.id;
        body.auth_id = currentUser.auth_id;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Une erreur est survenue");
      }

      // Refresh list
      fetchUsers();
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer ${user.first_name} ${user.last_name} ?`
      )
    )
      return;

    try {
      const response = await fetch(`/api/admin/users?auth_id=${user.auth_id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Erreur lors de la suppression");
      }

      setUsers(users.filter((u) => u.id !== user.id));
    } catch (error: any) {
      alert(error.message);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Shield className="w-3 h-3 mr-1" /> Admin
          </span>
        );
      case "parent":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <UserIcon className="w-3 h-3 mr-1" /> Parent
          </span>
        );
      case "child":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Baby className="w-3 h-3 mr-1" /> Enfant
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {role}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Actif
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Inactif
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Loader2 className="w-3 h-3 mr-1" />
            En attente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const ConnectionMap = ({ users }: { users: User[] }) => {
    const mapUsers = users
      .filter(u => u.latitude && u.longitude)
      .map(u => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email,
        status: u.status,
        lat: u.latitude!,
        lng: u.longitude!,
        role: u.role,
        city: u.last_login_city,
        lastActive: u.last_active_at,
        isOnline: onlineUsers.has(u.auth_id)
      }));

    const activeCount = onlineUsers.size;

    return (
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6 relative h-[400px] z-0">
        <div className="flex justify-between items-center mb-4 relative z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] flex items-center gap-2">
              <Globe className="text-[var(--greek-gold)]" size={24} />
              Carte des Connexions
            </h2>
            <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1 rounded-full border border-green-100">
               <span className="relative flex h-2 w-2">
                  <span className={`${activeCount > 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 Enrique`}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
               </span>
               <span className="text-xs font-bold text-green-700">{activeCount} en ligne</span>
            </div>
          </div>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
            Interactive & Temps Réel
          </span>
        </div>
        
        <div className="h-[300px] w-full">
           <UserMap users={mapUsers} />
        </div>
        
        <div className="absolute bottom-4 left-6 text-[10px] text-gray-400 italic z-[1000] pointer-events-none">
          * Coordonnées approximatives basées sur l'IP
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <Users className="text-[var(--greek-gold)]" size={32} />
              Gestion des Utilisateurs
            </h1>
            <p className="text-[var(--greek-bronze)] text-lg">
              Gérez les comptes parents, enfants et administrateurs
            </p>
          </div>
          <button
            onClick={() => handleOpenModal("create")}
            className="px-6 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium shadow-lg shadow-blue-900/10"
          >
            <Plus size={20} />
            Nouvel Utilisateur
          </button>
        </div>
      </div>

      {/* Connection Map */}
      <ConnectionMap users={users} />

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-[20px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Rechercher par nom, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)]/20 text-gray-700 placeholder-gray-400"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)]/20 text-gray-700"
          >
            <option value="all">Tous les rôles</option>
            <option value="admin">Administrateur</option>
            <option value="parent">Parent</option>
            <option value="child">Enfant</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)]/20 text-gray-700"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
            <option value="pending">En attente</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Inscription
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[var(--greek-blue)]" />
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-[var(--greek-blue)]/10 flex items-center justify-center text-[var(--greek-blue)] font-bold text-lg">
                          {user.first_name?.[0]}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal("edit", user)}
                          className="p-2 text-gray-400 hover:text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                {modalMode === "create"
                  ? "Ajouter un utilisateur"
                  : "Modifier l'utilisateur"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {modalMode === "create"
                    ? "Mot de passe"
                    : "Nouveau mot de passe (optionnel)"}
                </label>
                <input
                  type="text"
                  required={modalMode === "create"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 font-mono"
                  placeholder={
                    modalMode === "edit"
                      ? "Laisser vide pour ne pas changer"
                      : ""
                  }
                />
                {modalMode === "edit" && (
                   <div className="mt-2 p-4 bg-gray-50/80 rounded-2xl border border-gray-100 shadow-inner space-y-3">
                      <div className="flex items-center gap-2 border-b border-gray-200/50 pb-2">
                         <Shield size={16} className="text-[var(--greek-blue)]" />
                         <span className="font-bold text-sm text-[var(--greek-blue)]">Informations d'administration</span>
                      </div>
                      
                      {loadingAuth ? (
                        <div className="flex items-center justify-center py-4 gap-2 text-gray-400 italic text-xs">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Synchronisation des données...
                        </div>
                      ) : authDetails ? (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-gray-500">
                               <Clock size={12} />
                               <span>Dernière activité</span>
                            </div>
                            <div className="font-semibold text-gray-800 pl-4.5">
                              {authDetails.last_sign_in_at 
                                ? new Date(authDetails.last_sign_in_at).toLocaleString("fr-FR", { dateStyle: 'short', timeStyle: 'short' }) 
                                : "Aucune"}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-gray-500">
                               <Globe size={12} />
                               <span>Localisation</span>
                            </div>
                            <div className="font-semibold text-gray-800 pl-4.5">
                              {authDetails.geo?.city ? `${authDetails.geo.city}, ${authDetails.geo.country}` : "Inconnue"}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-gray-500">
                               <CheckCircle size={12} />
                               <span>Email vérifié</span>
                            </div>
                            <div className={`font-semibold pl-4.5 ${authDetails.email_confirmed_at ? "text-green-600" : "text-amber-600"}`}>
                              {authDetails.email_confirmed_at ? "Oui ✓" : "En attente"}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-gray-500">
                               <Laptop size={12} />
                               <span>Plateforme</span>
                            </div>
                            <div className="font-semibold text-gray-800 pl-4.5 truncate max-w-[120px]">
                              {authDetails.identities?.join(", ") || "Email classique"}
                            </div>
                          </div>

                          <div className="col-span-2 pt-2 flex items-center justify-between text-[9px] text-gray-400 bg-white/50 p-2 rounded-lg border border-gray-100">
                             <div className="flex items-center gap-1">
                                <MapPin size={8} />
                                <span>ID: <span className="font-mono select-all uppercase">{currentUser?.auth_id?.slice(0, 8)}...</span></span>
                             </div>
                             <div>Créé le {new Date(authDetails.created_at).toLocaleDateString("fr-FR")}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-red-500 italic text-center text-xs py-2 bg-red-50 rounded-lg">
                          Échec du chargement des informations Supabase
                        </div>
                      )}
                   </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                  >
                    <option value="parent">Parent</option>
                    <option value="child">Enfant</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modalMode === "create" ? "Créer" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
