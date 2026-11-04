"use client";

import GlassSwitch from "@/components/ui/GlassSwitch";
import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { supabase } from "@/lib/supabaseClient";
import { Fingerprint, Trash2, Loader2, CheckCircle } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { errMessage } from "@/lib/safeError";

interface Credential {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
}

/** Carte "Clé d'accès" (empreinte/Face ID) — partagée par les 3 pages profil
 * (admin/parent/enfant) : une bascule "Activée/Désactivée" pilotée par la
 * présence d'au moins une clé enregistrée, plus la liste des appareils
 * enrôlés. Self-service : la cérémonie WebAuthn s'exécute forcément sur
 * l'appareil qui affiche cette carte, quel que soit le rôle du compte. */
export default function WebAuthnCard() {
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [registering, setRegistering] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const authHeader = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const refetch = async () => {
    const res = await fetch("/api/auth/webauthn/status", { headers: await authHeader() });
    const data = await res.json();
    if (res.ok) setCredentials(data.credentials || []);
  };

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
    refetch().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = async () => {
    setError(null);
    setRegistering(true);
    try {
      const optionsRes = await fetch("/api/auth/webauthn/register/options", {
        method: "POST",
        headers: await authHeader(),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error || "Erreur");

      // Ouvre la boîte de dialogue empreinte/Face ID/clé de sécurité du
      // système — startRegistration() lève une erreur si l'utilisateur
      // annule, qu'aucun capteur n'est disponible, etc.
      const attResp = await startRegistration({ optionsJSON: options });

      const deviceLabel =
        typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent)
          ? "iPhone/iPad"
          : typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
            ? "Android"
            : typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent)
              ? "Mac"
              : "Cet appareil";

      const verifyRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ response: attResp, deviceLabel }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) throw new Error(verifyData.error || "Vérification échouée");

      await refetch();
    } catch (err: unknown) {
      // Fermer la boîte de dialogue système est un choix, pas une erreur —
      // voir le même commentaire dans ConnexionClient.tsx.
      if ((err instanceof Error ? err.name : "") !== "NotAllowedError") {
        setError(errMessage(err) || "Une erreur est survenue.");
      }
    } finally {
      setRegistering(false);
    }
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/auth/webauthn/credentials/${id}`, {
        method: "DELETE",
        headers: await authHeader(),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      setError(errMessage(err) || "Une erreur est survenue.");
    } finally {
      setRemovingId(null);
    }
  };

  // Bascule "activé/désactivé" : activer ajoute une clé tout de suite (sans
  // ça une bascule "activée" mais sans aucune clé n'aurait aucun sens) ;
  // désactiver retire TOUTES les clés enregistrées, en confirmant d'abord.
  const toggle = async (next: boolean) => {
    if (next) {
      await enable();
      return;
    }
    if (!window.confirm("Supprimer toutes les clés d'accès enregistrées ? Tu devras utiliser ton mot de passe pour te reconnecter.")) return;
    setError(null);
    const headers = await authHeader();
    for (const c of credentials) {
      await fetch(`/api/auth/webauthn/credentials/${c.id}`, { method: "DELETE", headers });
    }
    setCredentials([]);
  };

  if (loading) return null;

  const enabled = credentials.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
      <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
        <Fingerprint className="w-5 h-5 mr-2" />
        Clé d&apos;accès (empreinte / Face ID)
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Une fois activée, ton mot de passe ne suffit plus : à chaque connexion, l&apos;empreinte digitale, la
        reconnaissance faciale ou le code de cet appareil sera aussi demandé (avant la double authentification
        si elle est active).
      </p>

      {!supported && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          Cet appareil ou ce navigateur ne prend pas en charge les clés d&apos;accès.
        </p>
      )}

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <span className={`text-sm font-semibold flex items-center gap-1.5 ${enabled ? "text-green-700" : "text-gray-500"}`}>
          {enabled && <CheckCircle className="w-4 h-4" />}
          {enabled ? "Activée" : "Désactivée"}
        </span>
        <span className="flex items-center gap-2">
          {registering && <Loader2 className="w-4 h-4 animate-spin text-[var(--greek-blue)]" />}
          <GlassSwitch checked={enabled} disabled={!supported || registering} onChange={(next) => toggle(next)} label="Clé d'accès" />
        </span>
      </div>

      {credentials.length > 0 && (
        <div className="pt-4 border-t border-[rgba(197,161,72,0.15)] space-y-2">
          {credentials.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-gray-700">{c.device_label || "Appareil"}</p>
                <p className="text-xs text-gray-400">
                  Ajoutée le {new Date(c.created_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                  {c.last_used_at ? ` · utilisée le ${new Date(c.last_used_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}` : ""}
                </p>
              </div>
              <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => remove(c.id)} disabled={removingId === c.id} loading={removingId === c.id} aria-label="Supprimer cette clé" />
            </div>
          ))}
          <div className="mt-2">
            <GlassButton onClick={enable} disabled={registering} variant="outline" size="sm">+ Ajouter un autre appareil</GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}
