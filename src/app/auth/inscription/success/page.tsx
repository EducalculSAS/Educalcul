"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle, Loader2, AlertCircle, Mail } from "lucide-react";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "email_sent" | "error" | "delayed">("loading");
  const [message, setMessage] = useState("Création de votre compte en cours...");
  const [errorMsg, setErrorMsg] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) { router.replace("/auth/inscription"); return; }

    const cleanup = () => {
      sessionStorage.removeItem("educalcul_signup_data");
      sessionStorage.removeItem("educalcul_selected_plan");
      sessionStorage.removeItem("educalcul_signup_mode");
      sessionStorage.removeItem("educalcul_pending_role");
      sessionStorage.removeItem("educalcul_pending_auth_id");
    };

    const run = async () => {
      try {
        const stored = sessionStorage.getItem("educalcul_signup_data");
        if (!stored) {
          setStatus("error");
          setErrorMsg("Données d'inscription introuvables. Veuillez recommencer.");
          return;
        }

        const signupData = JSON.parse(stored);
        setUserEmail(signupData.email || "");

        // Plan gratuit : pas de paiement Stripe réel à confirmer, le compte
        // est créé directement (rien à frauder sur un plan à 0€).
        if (sessionId === "free") {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          setMessage("Création de votre compte...");

          const res = await fetch("/api/auth/create-account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...signupData, sessionId, existingAuthId: currentUser?.id || null }),
          });
          const result = await res.json();
          if (!res.ok) {
            setStatus("error");
            setErrorMsg(result.error || "Erreur lors de la création du compte.");
            return;
          }
          cleanup();
          if (result.requireEmailConfirm) { setStatus("email_sent"); return; }
          setMessage("Redirection vers votre espace...");
          setTimeout(() => router.replace("/parent/dashboard"), 800);
          return;
        }

        // Paiement Stripe réel : le compte est créé par le webhook, une fois
        // le paiement confirmé côté Stripe — on attend juste que ça arrive.
        // On vérifie par authId (fiable) plutôt que par email : l'email
        // affiché sur la page Stripe est modifiable par le payeur et peut
        // différer de l'email réel du compte.
        setMessage("Paiement confirmé, finalisation de votre compte...");
        const pendingAuthId = sessionStorage.getItem("educalcul_pending_auth_id");
        const { data: { user: liveUser } } = await supabase.auth.getUser();
        const statusQuery = pendingAuthId
          ? `authId=${encodeURIComponent(pendingAuthId)}`
          : liveUser
          ? `authId=${encodeURIComponent(liveUser.id)}`
          : `email=${encodeURIComponent(signupData.email)}`;

        const deadline = Date.now() + 20000;
        let ready = false;
        while (Date.now() < deadline) {
          const res = await fetch(`/api/auth/signup-status?${statusQuery}`);
          const json = await res.json().catch(() => null);
          if (json?.ready) { ready = true; break; }
          await new Promise(r => setTimeout(r, 1500));
        }

        if (!ready) {
          setStatus("delayed");
          return;
        }

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser && signupData.password) {
          await supabase.auth.signInWithPassword({ email: signupData.email, password: signupData.password });
        }

        cleanup();
        setMessage("Redirection vers votre espace...");
        setTimeout(() => router.replace("/parent/dashboard"), 800);
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err?.message || "Une erreur inattendue est survenue.");
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow border border-red-100 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Une erreur est survenue</h2>
          <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
          <button
            onClick={() => router.push("/auth/inscription")}
            className="px-6 py-2 bg-[var(--greek-blue)] text-white rounded-xl font-bold hover:opacity-90"
          >
            Recommencer l&apos;inscription
          </button>
        </div>
      </div>
    );
  }

  if (status === "delayed") {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow border border-[rgba(197,161,72,0.25)] p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Paiement bien reçu</h2>
          <p className="text-gray-500 text-sm mb-6">
            La finalisation de votre compte prend un peu plus de temps que prévu. Vous allez recevoir un email de confirmation
            dans les prochaines minutes — vous pourrez alors vous connecter avec {userEmail || "votre email"}.
          </p>
          <button
            onClick={() => router.push("/auth/connexion")}
            className="px-6 py-2 bg-[var(--greek-blue)] text-white rounded-xl font-bold hover:opacity-90"
          >
            Aller à la connexion
          </button>
        </div>
      </div>
    );
  }

  if (status === "email_sent") {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow border border-[rgba(197,161,72,0.25)] p-10 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail className="w-9 h-9 text-[var(--greek-blue)]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-3">
            Vérifiez votre email
          </h2>
          <p className="text-gray-600 mb-2">
            Un lien de confirmation a été envoyé à :
          </p>
          <p className="font-bold text-[var(--greek-blue)] mb-6 break-all">{userEmail}</p>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Cliquez sur le lien dans l'email pour accéder à votre espace et démarrer votre expérience Educalcul.
          </p>
          <div className="bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-xl p-4 text-sm text-gray-600">
            Pas reçu ? Vérifiez vos spams ou{" "}
            <button
              onClick={() => router.push("/auth/connexion")}
              className="text-[var(--greek-blue)] font-semibold hover:underline"
            >
              connectez-vous directement
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow border border-[rgba(197,161,72,0.25)] p-10 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-9 h-9 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-2">
          Paiement réussi !
        </h2>
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          {message}
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
