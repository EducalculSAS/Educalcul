import { supabaseAdmin } from "@/lib/supabaseClient";

const PAGE_SIZE = 50;
const EXPORT_MAX = 20000;
const EXPORT_BATCH = 1000;

export async function fetchAuditLogPage(page: number, action?: string | null) {
  let query = supabaseAdmin
    .from("audit_logs")
    .select("id, action, admin_id, target_user_id, target_type, target_id, details, ip_address, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (action) query = query.eq("action", action);

  const { data, error, count } = await query;
  if (error) throw error;

  const adminIds = Array.from(new Set((data || []).map((d) => d.admin_id).filter(Boolean)));
  const targetIds = Array.from(new Set((data || []).map((d) => d.target_user_id).filter(Boolean)));
  const allIds = Array.from(new Set([...adminIds, ...targetIds]));
  const { data: users } = allIds.length
    ? await supabaseAdmin.from("users").select("id, first_name, last_name, email").in("id", allIds)
    : { data: [] as any[] };
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));

  const entries = (data || []).map((d) => ({
    ...d,
    admin: usersById[d.admin_id] || null,
    target: d.target_user_id ? usersById[d.target_user_id] || null : null,
  }));

  return { entries, page, pageSize: PAGE_SIZE, total: count || 0 };
}

/** Pour l'export CSV — pas de pagination côté appelant, on va chercher tout
 * (plafonné à EXPORT_MAX) par lots de EXPORT_BATCH pour rester sous la limite
 * de lignes d'une requête Supabase. */
export async function fetchAllAuditLogEntries(action?: string | null) {
  const rows: any[] = [];
  for (let offset = 0; offset < EXPORT_MAX; offset += EXPORT_BATCH) {
    let query = supabaseAdmin
      .from("audit_logs")
      .select("id, action, admin_id, target_user_id, target_type, target_id, details, ip_address, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + EXPORT_BATCH - 1);

    if (action) query = query.eq("action", action);

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < EXPORT_BATCH) break;
  }

  const adminIds = Array.from(new Set(rows.map((d) => d.admin_id).filter(Boolean)));
  const targetIds = Array.from(new Set(rows.map((d) => d.target_user_id).filter(Boolean)));
  const allIds = Array.from(new Set([...adminIds, ...targetIds]));
  const { data: users } = allIds.length
    ? await supabaseAdmin.from("users").select("id, first_name, last_name, email").in("id", allIds)
    : { data: [] as any[] };
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));

  return rows.map((d) => ({
    ...d,
    admin: usersById[d.admin_id] || null,
    target: d.target_user_id ? usersById[d.target_user_id] || null : null,
  }));
}
