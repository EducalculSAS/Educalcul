-- Ces deux fonctions ne sont utilisées par aucune politique RLS : l'app passe par la clé service.
-- Elles ne doivent plus être appelables via /rest/v1/rpc.
revoke execute on function public.get_my_parent_id() from public, anon, authenticated;
revoke execute on function public.get_my_user_id() from public, anon, authenticated;
