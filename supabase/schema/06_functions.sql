-- Fonctions du schéma public (export de pg_get_functiondef).
-- À exécuter AVANT 07_triggers_views.sql (les triggers s'y réfèrent).

CREATE OR REPLACE FUNCTION public.admin_force_delete_auth_user(target_auth_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  delete from auth.users where id = target_auth_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_item_counts_by_folder(p_kind text)
 RETURNS TABLE(folder_id bigint, items bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select e.folder_id, count(*) from exercises e
    where p_kind = 'exercise' and e.folder_id is not null group by e.folder_id
  union all
  select q.folder_id, count(*) from quizzes q
    where p_kind = 'quiz' and q.folder_id is not null group by q.folder_id
  union all
  select c.folder_id, count(*) from courses c
    where p_kind = 'course' and c.folder_id is not null group by c.folder_id
$function$;

CREATE OR REPLACE FUNCTION public.admin_item_counts_by_folder_json(p_kind text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_object_agg(folder_id::text, items), '{}'::jsonb)
  from public.admin_item_counts_by_folder(p_kind);
$function$;

CREATE OR REPLACE FUNCTION public.admin_minigame_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_object_agg(game_type, jsonb_build_object(
    'plays', plays, 'completed', completed, 'totalScore', total_score)), '{}'::jsonb)
  from (
    select game_type,
           count(*) as plays,
           count(*) filter (where status = 'completed') as completed,
           coalesce(sum(score) filter (where status = 'completed'), 0) as total_score
    from minigame_sessions group by game_type
  ) t;
$function$;

CREATE OR REPLACE FUNCTION public.admin_report_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'top_countries', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'count', n) order by n desc)
      from (
        select last_login_country as country, count(*) as n
        from users where last_login_country is not null
        group by last_login_country order by n desc limit 5
      ) t), '[]'::jsonb),
    'avg_quiz_score', (select round(avg(score)::numeric, 1) from user_quiz_attempts where score is not null)
  );
$function$;

CREATE OR REPLACE FUNCTION public.bump_review_day(p_user bigint, p_day date, p_n integer)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  insert into public.student_review_days (user_id, day, count) values (p_user, p_day, p_n)
  on conflict (user_id, day) do update set count = public.student_review_days.count + excluded.count;
$function$;

CREATE OR REPLACE FUNCTION public.bump_srs_mastered(p_user bigint, p_n integer)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  insert into public.student_meta (user_id, srs_mastered) values (p_user, p_n)
  on conflict (user_id) do update set srs_mastered = public.student_meta.srs_mastered + excluded.srs_mastered, updated_at = now();
$function$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max_attempts integer, p_window_ms bigint, p_max_failures integer DEFAULT 10, p_block_duration_ms bigint DEFAULT 3600000)
 RETURNS TABLE(allowed boolean, remaining integer, reset_in bigint, blocked boolean, blocked_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.rate_limits%rowtype;
  v_window interval := (p_window_ms || ' milliseconds')::interval;
  v_block interval := (p_block_duration_ms || ' milliseconds')::interval;
begin
  -- Nettoyage occasionnel des anciennes entrées
  if random() < 0.01 then
    delete from public.rate_limits as rl
    where rl.reset_at < v_now - interval '1 day'
      and (
        rl.blocked_until is null
        or rl.blocked_until < v_now
      );
  end if;

  insert into public.rate_limits (
    key,
    count,
    reset_at
  )
  values (
    p_key,
    0,
    v_now + v_window
  )
  on conflict (key) do nothing;

  select rl.*
  into v_row
  from public.rate_limits as rl
  where rl.key = p_key
  for update;

  -- Blocage actif
  if v_row.blocked_until is not null
     and v_now < v_row.blocked_until then
    return query
    select
      false,
      0,
      ceil(
        extract(epoch from (v_row.blocked_until - v_now)) * 1000
      )::bigint,
      true,
      v_row.blocked_until;

    return;
  end if;

  -- Blocage expiré
  if v_row.blocked_until is not null
     and v_now >= v_row.blocked_until then
    update public.rate_limits as rl
    set
      blocked_until = null,
      overflow_count = 0
    where rl.key = p_key;

    v_row.blocked_until := null;
    v_row.overflow_count := 0;
  end if;

  -- Fenêtre expirée
  if v_now > v_row.reset_at then
    update public.rate_limits as rl
    set
      count = 1,
      reset_at = v_now + v_window
    where rl.key = p_key;

    return query
    select
      true,
      greatest(p_max_attempts - 1, 0),
      p_window_ms,
      false,
      null::timestamptz;

    return;
  end if;

  -- Requête autorisée dans la fenêtre
  if v_row.count < p_max_attempts then
    update public.rate_limits as rl
    set count = rl.count + 1
    where rl.key = p_key;

    return query
    select
      true,
      greatest(p_max_attempts - (v_row.count + 1), 0),
      ceil(
        extract(epoch from (v_row.reset_at - v_now)) * 1000
      )::bigint,
      false,
      null::timestamptz;

    return;
  end if;

  -- Trop de dépassements : blocage
  if v_row.overflow_count + 1 >= p_max_failures then
    update public.rate_limits as rl
    set
      overflow_count = v_row.overflow_count + 1,
      blocked_until = v_now + v_block
    where rl.key = p_key;

    return query
    select
      false,
      0,
      p_block_duration_ms,
      true,
      v_now + v_block;

    return;
  end if;

  -- Dépassement simple, sans blocage prolongé
  update public.rate_limits as rl
  set overflow_count = v_row.overflow_count + 1
  where rl.key = p_key;

  return query
  select
    false,
    0,
    ceil(
      extract(epoch from (v_row.reset_at - v_now)) * 1000
    )::bigint,
    false,
    null::timestamptz;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_calia_demo(p_id text, p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v integer;
begin
  insert into public.calia_demo_usage (ip, count)
  values (p_id, 1)
  on conflict (ip) do update
    set count = public.calia_demo_usage.count + 1, used_at = now()
    where public.calia_demo_usage.count < p_limit
  returning count into v;
  return coalesce(v, -1);
end;
$function$;

CREATE OR REPLACE FUNCTION public.clamp_exercise_attempt_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_points numeric;
  threshold numeric;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM((block->>'points')::numeric), 0), MAX(e.min_score_percent)
  INTO max_points, threshold
  FROM exercises e
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(e.content_json, '[]'::jsonb)) AS page ON true
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(page->'blocks', '[]'::jsonb)) AS block ON true
  WHERE e.id = NEW.exercise_id
  GROUP BY e.id;

  IF NEW.score IS NULL OR NEW.score < 0 THEN
    NEW.score := 0;
  END IF;

  IF max_points > 0 THEN
    IF NEW.score > max_points THEN
      NEW.score := max_points;
    END IF;
    NEW.score_percent := round((NEW.score / max_points) * 100);
    IF NEW.status = 'completed' THEN
      NEW.passed := (threshold IS NULL OR threshold = 0 OR NEW.score_percent >= threshold);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clamp_quiz_attempt_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_points numeric;
  threshold numeric;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(COALESCE((q->>'points')::numeric, 1)), 0), MAX(qz.min_score_percent)
  INTO max_points, threshold
  FROM quizzes qz
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(qz.content_json, '[]'::jsonb)) AS q ON true
  WHERE qz.id = NEW.quiz_id
  GROUP BY qz.id;

  IF NEW.score IS NULL OR NEW.score < 0 THEN
    NEW.score := 0;
  END IF;

  IF max_points > 0 THEN
    IF NEW.score > max_points THEN
      NEW.score := max_points;
    END IF;
    NEW.score_percent := round((NEW.score / max_points) * 100);
    IF NEW.status = 'completed' THEN
      NEW.passed := (threshold IS NULL OR threshold = 0 OR NEW.score_percent >= threshold);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.course_folders_inherit_level()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.grade_level is null and new.parent_id is not null then
    select grade_level into new.grade_level from public.course_folders where id = new.parent_id;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_auth_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id BIGINT;
  v_child   RECORD;
BEGIN
  -- Récupérer l'id DB du parent
  SELECT id INTO v_user_id FROM users WHERE auth_id = p_auth_id;
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Supprimer les enfants d'abord
  FOR v_child IN SELECT id, auth_id FROM users WHERE parent_id = v_user_id AND role = 'child' LOOP
    DELETE FROM users WHERE id = v_child.id;
    -- L'auth user enfant sera supprimé par l'app après
  END LOOP;

  -- Supprimer le parent (cascade supprime les tables liées)
  DELETE FROM users WHERE id = v_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_auth_id_by_email(p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Email principal auth.users
  SELECT id INTO v_id FROM auth.users
  WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- 2. Email dans auth.identities (compte Google lié)
  SELECT user_id INTO v_id FROM auth.identities
  WHERE lower(identity_data->>'email') = lower(p_email) LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- 3. Email dans public.users
  SELECT auth_id INTO v_id FROM public.users
  WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.forum_comment_counters()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update forum_posts set comment_count = comment_count + 1, last_activity_at = new.created_at where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update forum_posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.forum_increment_view(p_post_id bigint)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update forum_posts set view_count = view_count + 1 where id = p_post_id;
$function$;

CREATE OR REPLACE FUNCTION public.forum_like_counters()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare delta int := case when tg_op = 'INSERT' then 1 else -1 end;
declare r record;
begin
  r := case when tg_op = 'INSERT' then new else old end;
  if r.post_id is not null then
    update forum_posts set like_count = greatest(like_count + delta, 0) where id = r.post_id;
  else
    update forum_comments set like_count = greatest(like_count + delta, 0) where id = r.comment_id;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.get_my_parent_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select parent_id from public.users where auth_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_user_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  -- Pour les signups email/password, on a first_name dans les métadonnées
  -- Pour Google OAuth, on a given_name/family_name
  user_role := COALESCE((new.raw_user_meta_data->>'role')::TEXT, 'parent');
  user_first_name := COALESCE(
    new.raw_user_meta_data->>'first_name',  -- email/password flow (notre create-account)
    NULL  -- Google OAuth : on laisse NULL intentionnellement
          -- → le callback détecte first_name=null = compte non complété
  );
  user_last_name := new.raw_user_meta_data->>'last_name';

  INSERT INTO public.users (auth_id, email, first_name, last_name, role, status)
  VALUES (
    new.id,
    new.email,
    user_first_name,
    user_last_name,
    user_role,
    'active'
  )
  ON CONFLICT (email)
  DO UPDATE SET
    auth_id = EXCLUDED.auth_id,
    status = 'active',
    updated_at = now();

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inherit_folder_style_from_parent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare parent_color text; parent_level text;
begin
  if new.parent_id is null then
    return new;
  end if;

  if tg_table_name = 'exercise_folders' then
    select color, grade_level into parent_color, parent_level
      from exercise_folders where id = new.parent_id;
  else
    select color, grade_level into parent_color, parent_level
      from quiz_folders where id = new.parent_id;
  end if;

  -- Une valeur explicitement choisie par l'admin n'est jamais écrasée.
  if new.color is null then new.color := parent_color; end if;
  if new.grade_level is null then new.grade_level := parent_level; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_auth_sessions(p_auth_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, user_agent text, ip text, not_after timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select s.id, s.created_at, s.updated_at, s.user_agent, s.ip::text, s.not_after
  from auth.sessions s
  where s.user_id = p_auth_id
  order by coalesce(s.updated_at, s.created_at) desc;
$function$;

CREATE OR REPLACE FUNCTION public.log_error(p_fingerprint text, p_source text, p_message text, p_stack text, p_url text, p_user_agent text, p_user_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare prev_resolved boolean;
begin
  select resolved into prev_resolved from error_logs where fingerprint = p_fingerprint;
  insert into error_logs (fingerprint, source, message, stack, url, user_agent, user_id)
  values (p_fingerprint, p_source, left(p_message, 1000), left(p_stack, 6000), left(p_url, 500), left(p_user_agent, 300), p_user_id)
  on conflict (fingerprint) do update set
    count = error_logs.count + 1,
    last_seen = now(),
    url = excluded.url,
    user_agent = excluded.user_agent,
    user_id = coalesce(excluded.user_id, error_logs.user_id),
    resolved = false;
  -- Nouvelle erreur, ou erreur qui revient après avoir été marquée résolue.
  return prev_resolved is null or prev_resolved;
end $function$;

CREATE OR REPLACE FUNCTION public.merge_catalogue_lesson(p_slug text, p_title text, p_folder_id bigint, p_level text, p_subject text, p_chapter_key text, p_chapter_title text, p_chapter_order integer, p_lesson jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_id bigint;
  v_chapters jsonb;
  v_idx int;
  v_chapter jsonb;
  v_lessons jsonb;
  v_lidx int;
  v_lesson_id text := p_lesson->>'id';
  v_total_duration int;
begin
  select id, coalesce(content_json, '[]'::jsonb) into v_id, v_chapters
  from public.courses where slug = p_slug for update;

  if v_id is null then
    v_chapters := '[]'::jsonb;
  end if;

  v_idx := null;
  for i in 0 .. jsonb_array_length(v_chapters) - 1 loop
    if v_chapters->i->>'id' = p_chapter_key then
      v_idx := i;
      exit;
    end if;
  end loop;

  if v_idx is null then
    v_chapter := jsonb_build_object(
      'id', p_chapter_key,
      'title', p_chapter_title,
      'order', p_chapter_order,
      'lessons', jsonb_build_array(p_lesson)
    );
    v_chapters := v_chapters || jsonb_build_array(v_chapter);
  else
    v_chapter := jsonb_set(v_chapters->v_idx, '{title}', to_jsonb(p_chapter_title));
    v_lessons := coalesce(v_chapter->'lessons', '[]'::jsonb);
    v_lidx := null;
    for j in 0 .. jsonb_array_length(v_lessons) - 1 loop
      if v_lessons->j->>'id' = v_lesson_id then
        v_lidx := j;
        exit;
      end if;
    end loop;
    if v_lidx is null then
      v_lessons := v_lessons || jsonb_build_array(p_lesson);
    else
      v_lessons := jsonb_set(v_lessons, array[v_lidx::text], p_lesson);
    end if;
    v_chapter := jsonb_set(v_chapter, '{lessons}', v_lessons);
    v_chapters := jsonb_set(v_chapters, array[v_idx::text], v_chapter);
  end if;

  select jsonb_agg(c order by (c->>'order')::int)
  into v_chapters
  from jsonb_array_elements(v_chapters) c;

  select coalesce(sum((l->>'duration')::int), 0)
  into v_total_duration
  from jsonb_array_elements(v_chapters) c, jsonb_array_elements(c->'lessons') l;

  if v_id is null then
    insert into public.courses (slug, title, level, subject, folder_id, status, content_json, estimated_time)
    values (p_slug, p_title, p_level, p_subject, p_folder_id, 'draft', v_chapters, v_total_duration)
    returning id into v_id;
  else
    update public.courses
    set content_json = v_chapters,
        title = p_title,
        estimated_time = v_total_duration
    where id = v_id;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.minigame_leaderboard(p_game_type text, p_grade_levels text[], p_since timestamp with time zone, p_me integer, p_limit integer DEFAULT 20)
 RETURNS TABLE(user_id integer, total bigint, best_duration integer, total_duration bigint, rank bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with agg as (
    select s.user_id,
           sum(coalesce(s.score, 0))::bigint as total,
           min(s.duration_seconds) as best_duration,
           sum(s.duration_seconds)::bigint as total_duration
    from minigame_sessions s
    where s.game_type = p_game_type
      and s.status = 'completed'
      and s.grade_level = any(p_grade_levels)
      and (p_since is null or s.created_at >= p_since)
    group by s.user_id
  ), ranked as (
    select agg.*, row_number() over (order by total desc, best_duration asc nulls last, user_id) as rank
    from agg
  )
  select user_id, total, best_duration, total_duration, rank
  from ranked
  where rank <= p_limit or user_id = p_me
  order by rank;
$function$;

CREATE OR REPLACE FUNCTION public.minigame_played_days(p_user integer, p_games text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_object_agg(game_type, days), '{}'::jsonb)
  from (
    select game_type, jsonb_agg(distinct (created_at at time zone 'UTC')::date::text) as days
    from minigame_sessions
    where user_id = p_user and status = 'completed' and game_type = any(p_games)
      and created_at >= now() - interval '400 days'
    group by game_type
  ) t;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Le service role (routes API serveur admin) garde un accès total.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modification du rôle non autorisée';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Modification du statut non autorisée';
  END IF;
  IF NEW.ban_reason IS DISTINCT FROM OLD.ban_reason THEN
    RAISE EXCEPTION 'Modification du motif de bannissement non autorisée';
  END IF;
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'Modification du rattachement parental non autorisée';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_auth_session(p_auth_id uuid, p_session_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  affected int;
begin
  delete from auth.sessions where id = p_session_id and user_id = p_auth_id;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sanitize_forum_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.content := public.strip_html_tags(new.content);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sanitize_forum_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.title := public.strip_html_tags(new.title);
  new.content := public.strip_html_tags(new.content);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.strip_html_tags(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select regexp_replace(coalesce(input, ''), '<[^>]*>', '', 'g');
$function$;

CREATE OR REPLACE FUNCTION public.sync_folder_names_from_course()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.title is distinct from old.title then
    update exercise_folders set name = new.title, updated_at = now()
      where course_id = new.id and name is distinct from new.title;
    update quiz_folders set name = new.title, updated_at = now()
      where course_id = new.id and name is distinct from new.title;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_user_has_passkey()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  uid bigint := coalesce(new.user_id, old.user_id);
begin
  update public.users
     set has_passkey = exists (select 1 from public.webauthn_credentials w where w.user_id = uid)
   where id = uid;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_course_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  chapter_count integer;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT jsonb_array_length(COALESCE(content_json, '[]'::jsonb))
  INTO chapter_count
  FROM courses
  WHERE id = NEW.course_id;

  IF chapter_count IS NULL THEN
    chapter_count := 0;
  END IF;

  IF NEW.chapter_index IS NULL OR NEW.chapter_index < 0 THEN
    NEW.chapter_index := 0;
  ELSIF chapter_count > 0 AND NEW.chapter_index > chapter_count - 1 THEN
    NEW.chapter_index := chapter_count - 1;
  END IF;

  -- Un cours ne peut être marqué "terminé" que si l'élève a effectivement
  -- atteint le dernier chapitre — empêche de sauter directement à "completed"
  -- sans avoir progressé (via un appel direct à l'API Supabase).
  IF NEW.status = 'completed' AND chapter_count > 0 AND NEW.chapter_index < chapter_count - 1 THEN
    NEW.status := 'in_progress';
  END IF;

  RETURN NEW;
END;
$function$;
