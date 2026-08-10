import { supabaseAdmin } from "@/lib/supabaseClient";

/** Liste blanche d'IP pour l'accès admin — désactivée tant qu'aucune entrée
 * n'existe (évite tout risque de se bloquer soi-même au premier déploiement).
 * Dès qu'une entrée est ajoutée, l'accès admin (pages ET API) est restreint
 * aux IP listées, pour TOUS les comptes admin — pas de portée par admin :
 * c'est une garde globale, pas un réglage personnel. */

function ipToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

/** `cidr` peut être une IP simple ("203.0.113.4", traitée comme /32) ou une
 * plage ("203.0.113.0/24"). IPv4 uniquement — le cas d'usage réel ici est une
 * poignée d'IP fixes (bureau/domicile), pas un réseau IPv6 complexe. */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const ipNum = ipToInt(ip);
  if (ipNum === null) return false;

  const [base, prefixStr] = cidr.includes("/") ? cidr.split("/") : [cidr, "32"];
  const baseNum = ipToInt(base);
  const prefix = Number(prefixStr);
  if (baseNum === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

export async function isAdminIpAllowed(ip: string | null): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from("admin_ip_allowlist").select("cidr");
  if (error) return true; // panne de lecture de la liste → on n'aggrave pas en bloquant tous les admins
  if (!data || data.length === 0) return true; // liste vide = fonctionnalité désactivée

  if (!ip) return false;
  return data.some((row) => ipMatchesCidr(ip, row.cidr));
}
