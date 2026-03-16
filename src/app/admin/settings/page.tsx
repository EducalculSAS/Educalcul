"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Database,
  CreditCard,
  Cpu,
  Globe,
  Loader2,
  Copy,
  Check
} from "lucide-react";

interface EnvConfig {
  supabase: Record<string, string>;
  stripe: Record<string, string>;
  ai: Record<string, string>;
  app: Record<string, string>;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<EnvConfig | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const Section = ({ title, icon: Icon, data }: { title: string; icon: any; data: Record<string, string> }) => (
    <div className="bg-white rounded-[20px] shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="bg-[var(--greek-blue)]/5 px-8 py-6 border-b border-gray-100 flex items-center gap-3">
        <Icon className="text-[var(--greek-blue)]" size={24} />
        <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
          {title}
        </h2>
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 gap-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="font-mono text-sm text-gray-600 mb-2 md:mb-0">{key}</span>
              <div className="flex items-center gap-3">
                <code className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-mono text-[var(--greek-blue)]">
                  {value}
                </code>
                {value !== "Non défini" && !value.includes("...") && (
                   <button
                   onClick={() => copyToClipboard(value, key)}
                   className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                   title="Copier"
                 >
                   {copied === key ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                 </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin text-[var(--greek-blue)]" size={48} />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden mb-8">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
            <Settings className="text-[var(--greek-gold)]" size={32} />
            Configuration du Serveur
          </h1>
          <p className="text-[var(--greek-bronze)] text-lg">
            Variables d'environnement détectées (.env.local)
            <br />
            <span className="text-sm opacity-75">
              Note : Les clés secrètes sont partiellement masquées.
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Section title="Supabase" icon={Database} data={config.supabase} />
        <Section title="Stripe" icon={CreditCard} data={config.stripe} />
        <Section title="Intelligence Artificielle" icon={Cpu} data={config.ai} />
        <Section title="Système" icon={Globe} data={config.app} />
      </div>
    </div>
  );
}
