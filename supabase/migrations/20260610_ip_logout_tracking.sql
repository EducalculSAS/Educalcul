-- Logout tracking + drop GPS-consent columns (replaced by IP-based geolocation)

alter table users
  add column if not exists last_logout_at timestamptz,
  add column if not exists last_logout_ip text,
  add column if not exists last_logout_city text,
  add column if not exists last_logout_country text;

alter table user_login_history
  add column if not exists logged_out_at timestamptz,
  add column if not exists logout_ip text,
  add column if not exists logout_city text,
  add column if not exists logout_country text;

alter table users drop column if exists location_precise;
