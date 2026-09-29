// Safe, client-readable columns of public.users.
//
// The browser (anon/authenticated Supabase client) is NOT granted SELECT on the
// forensic columns: password_hash, last_login_ip/city/country, latitude,
// longitude, user_agent, device_type, last_logout_ip/city/country. Selecting "*"
// from the client therefore fails ("permission denied for column ..."). Use this
// constant for any client-side `select` that previously used "*".
//
// Server code (service-role API routes) is unaffected and may still select "*".
export const USER_SELECT_COLUMNS =
  "id, auth_id, email, child_username, first_name, last_name, role, parent_id, " +
  "grade_level, avatar, status, created_at, updated_at, account_type, " +
  "subscription_plan_id, subscription_expires_at, child_age, last_active_at, " +
  "avatar_border, name_animation, pending_discount_percent, name_color, " +
  "equipped_border, featured_badges, login_count, login_streak, last_login_date, " +
  "ban_reason, ban_until, onboarding_completed, cgu_accepted_at, " +
  "notif_weekly_reports, notif_offers_news, last_logout_at, school_zone, two_factor_enabled, calia_voice, theme_preference";
