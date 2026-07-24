import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";


export async function GET(request: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const viewMode = searchParams.get('view_mode') || 'active'; // 'active' or 'archived'

    let query = supabaseAdmin
      .from('support_tickets')
      .select('*');

    if (viewMode === 'archived') {
      query = query.eq('is_archived', true).order('archived_at', { ascending: false });
    } else {
      query = query.eq('is_archived', false);
      // We will sort in memory for the complex priority/status logic to match PHP
      // or we can just order by updated_at for now and let client sort.
      // Let's order by updated_at here as a baseline
      query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching tickets:", error);
        return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    }

    // PHP Logic for sorting active tickets:
    // ORDER BY CASE priority WHEN 'high' THEN 0 ELSE 1 END ASC,
    // CASE status WHEN 'Ouvert' THEN 1 WHEN 'En cours' THEN 2 WHEN 'Répondu' THEN 3 WHEN 'Résolu' THEN 4 ELSE 5 END ASC,
    // updated_at DESC
    
    if (viewMode !== 'archived' && data) {
        const statusOrder: Record<string, number> = {
            'Ouvert': 1,
            'En cours': 2,
            'Répondu': 3,
            'Résolu': 4
        };

        data.sort((a, b) => {
            // 1. Priority 'high' first
            const priorityA = a.priority === 'high' ? 0 : 1;
            const priorityB = b.priority === 'high' ? 0 : 1;
            if (priorityA !== priorityB) return priorityA - priorityB;

            // 2. Status order
            const statusA = statusOrder[a.status] || 5;
            const statusB = statusOrder[b.status] || 5;
            if (statusA !== statusB) return statusA - statusB;

            // 3. Updated At DESC
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
