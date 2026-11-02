-- Extensions, triggers, event trigger et vue du schéma public.
create extension if not exists "btree_gist";
create extension if not exists "pg_cron";
create extension if not exists "pg_graphql";
create extension if not exists "pg_net";
create extension if not exists "pg_stat_statements";
create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";
create extension if not exists "pgmq";
create extension if not exists "plpgsql";
create extension if not exists "supabase_vault";
create extension if not exists "uuid-ossp";

CREATE TRIGGER course_folders_inherit_level BEFORE INSERT OR UPDATE OF parent_id, grade_level ON public.course_folders FOR EACH ROW EXECUTE FUNCTION course_folders_inherit_level();
CREATE TRIGGER courses_sync_folder_names AFTER UPDATE OF title ON public.courses FOR EACH ROW EXECUTE FUNCTION sync_folder_names_from_course();
CREATE TRIGGER exercise_folders_inherit_style BEFORE INSERT ON public.exercise_folders FOR EACH ROW EXECUTE FUNCTION inherit_folder_style_from_parent();
CREATE TRIGGER forum_comments_counters AFTER INSERT OR DELETE ON public.forum_comments FOR EACH ROW EXECUTE FUNCTION forum_comment_counters();
CREATE TRIGGER forum_likes_counters AFTER INSERT OR DELETE ON public.forum_likes FOR EACH ROW EXECUTE FUNCTION forum_like_counters();
CREATE TRIGGER quiz_folders_inherit_style BEFORE INSERT ON public.quiz_folders FOR EACH ROW EXECUTE FUNCTION inherit_folder_style_from_parent();
CREATE TRIGGER trg_clamp_exercise_attempt_score BEFORE INSERT OR UPDATE ON public.user_exercise_attempts FOR EACH ROW EXECUTE FUNCTION clamp_exercise_attempt_score();
CREATE TRIGGER trg_clamp_quiz_attempt_score BEFORE INSERT OR UPDATE ON public.user_quiz_attempts FOR EACH ROW EXECUTE FUNCTION clamp_quiz_attempt_score();
CREATE TRIGGER trg_prevent_self_privilege_escalation BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION prevent_self_privilege_escalation();
CREATE TRIGGER trg_sanitize_forum_comment BEFORE INSERT OR UPDATE ON public.forum_comments FOR EACH ROW EXECUTE FUNCTION sanitize_forum_comment();
CREATE TRIGGER trg_sanitize_forum_post BEFORE INSERT OR UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION sanitize_forum_post();
CREATE TRIGGER trg_validate_course_progress BEFORE INSERT OR UPDATE ON public.user_course_progress FOR EACH ROW EXECUTE FUNCTION validate_course_progress();
CREATE TRIGGER webauthn_credentials_sync_has_passkey AFTER INSERT OR DELETE OR UPDATE OF user_id ON public.webauthn_credentials FOR EACH ROW EXECUTE FUNCTION sync_user_has_passkey();

-- Active RLS automatiquement sur toute nouvelle table du schéma public.
create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();

create or replace view public.user_public_profiles as
 SELECT id, first_name, last_name, child_username, avatar, role,
        equipped_border, name_color, featured_badges, grade_level
   FROM users;
