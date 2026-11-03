import type { Database } from "@/types/database";

/** Ligne d'une table du schéma public (types générés depuis la base : `src/types/database.ts`, à régénérer quand le schéma change). */
export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
