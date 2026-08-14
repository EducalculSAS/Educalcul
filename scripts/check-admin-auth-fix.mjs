import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const checks = [];
const add = (label, ok) => checks.push([label, Boolean(ok)]);

const header = read("src/components/admin/AdminPageHeader.tsx");
const forum = read("src/app/admin/forum/page.tsx");
const audit = read("src/app/admin/audit-log/page.tsx");
const scanner = read("src/app/admin/scanner/page.tsx");
const layout = read("src/app/admin/layout.tsx");
const profile = read("src/app/admin/profile/page.tsx");
const calendar = read("src/app/admin/calendar/page.tsx");
const shell = read("src/components/admin/AdminShell.tsx");
const navbar = read("src/components/Navbar.tsx");
const server = read("src/lib/supabase/server.ts");
const redirect = read("src/lib/authRedirect.ts");
const clearRoute = read("src/app/api/auth/2fa/clear-session/route.ts");

add("AdminPageHeader accepte une icone serialisable", header.includes("iconName?: ServerSafeAdminIcon"));
add("Forum ne passe plus MessageSquare comme fonction", forum.includes('iconName="message-square"') && !forum.includes("icon={MessageSquare}"));
add("Audit ne passe plus History comme fonction", audit.includes('iconName="history"') && !audit.includes("icon={History}"));
add("Scanner ne passe plus ScanSearch comme fonction", scanner.includes('iconName="scan-search"') && !scanner.includes("icon={ScanSearch}"));
add("Layout admin authentifie avec getUser", layout.includes("supabase.auth.getUser()") && !layout.includes("supabase.auth.getSession()"));
add("Layout admin verifie la session 2FA avant rendu", layout.includes("two_factor_sessions") && layout.includes("getTwoFactorCookie"));
add("Profil admin utilise getUser", profile.includes("supabase.auth.getUser()") && !profile.includes("getSession()"));
add("Calendrier admin utilise getUser", calendar.includes("supabase.auth.getUser()") && !calendar.includes("getSession()"));
add("Helper serveur utilise getUser", server.includes("supabase.auth.getUser()") && !server.includes("supabase.auth.getSession()"));
add("Navbar ne fait plus confiance a session.user", navbar.includes("supabase.auth.getUser()") && !navbar.includes("setUser(session?.user"));
add("Redirection post-auth utilise getUser", redirect.includes("const { data: { user } } = await supabase.auth.getUser()"));
add("Logout admin efface la session 2FA", shell.includes('event !== "SIGNED_OUT"') && shell.includes('/api/auth/2fa/clear-session'));
add("Route de purge 2FA presente", clearRoute.includes("clearTwoFactorCookie"));

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} - ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`\nOK - ${checks.length} controles admin/auth passent.`);
