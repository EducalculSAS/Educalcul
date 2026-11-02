# Instantané du schéma de la base

Export du schéma `public` de la base de production (Supabase), fait via SQL
(sans mot de passe de base ni `supabase db dump`). Le dossier `supabase/migrations`
ne contient qu'une partie de l'historique : ce dossier est la photo fidèle de l'état réel.

Ordre d'application sur une base vide :

1. `01_tables.sql`
2. `02_constraints.sql`
3. `03_foreign_keys.sql`
4. `04_indexes.sql`
5. `06_functions.sql` (avant les triggers)
6. `05_rls_policies.sql`
7. `07_triggers_views.sql`

Limites : l'export ne couvre ni les schémas `auth` / `storage`, ni les données, ni les
`GRANT` explicites. Ne pas appliquer tel quel sur la production : c'est une référence.
