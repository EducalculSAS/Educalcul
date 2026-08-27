"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { supabase } from "@/lib/supabaseClient";
import { Fingerprint, Trash2, Loader2, CheckCircle } from "lucide-react";

interface Credential {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
}

/** Carte "Clé d'accès" (empreinte/Face ID) du profil admin — même esprit que
 * AdminTotpCard : une bascule "Activée/Désactivée" pilotée par la présence
 * d'au moins une clé enregistrée, plus la liste des appareils enrôlés. */
export default function AdminWebAuthnCard() {
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
    } catch (err: any) {
      setError(err?.message === "The operation either timed out or was not allowed."
        ? "Annulé, ou aucune empreinte/Face ID configurée sur cet appareil."
        : (err?.message || "Une erreur est survenue."));
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
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue.");
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
        Connecte-toi sans mot de passe grâce à l&apos;empreinte digitale, la reconnaissance faciale ou le code de
        cet appareil, comme une application native.
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
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!supported || registering}
          onClick={() => toggle(!enabled)}
          className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-[var(--greek-blue)]" : "bg-gray-300"}`}
        >
          {registering ? (
            <Loader2 className="w-4 h-4 animate-spin text-white absolute top-1.5 left-1.5" />
          ) : (
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
            />
          )}
        </button>
      </div>

      {credentials.length > 0 && (
        <div className="pt-4 border-t border-[rgba(197,161,72,0.15)] space-y-2">
          {credentials.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-gray-700">{c.device_label || "Appareil"}</p>
                <p className="text-xs text-gray-400">
                  Ajoutée le {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  {c.last_used_at ? ` · utilisée le ${new Date(c.last_used_at).toLocaleDateString("fr-FR")}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={removingId === c.id}
                aria-label="Supprimer cette clé"
                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                {removingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={enable}
            disabled={registering}
            className="text-xs font-semibold text-[var(--greek-blue)] hover:underline disabled:opacity-50 mt-2"
          >
            + Ajouter un autre appareil
          </button>
        </div>
      )}
    </div>
  );
}
