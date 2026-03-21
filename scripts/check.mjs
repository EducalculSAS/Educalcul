import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE);

async function check() {
  const { data, error } = await sb.from('user_exercise_attempts').select('*').limit(1);
  console.log("EXERCISES ERROR:", error?.message || "Works fine");

  const { data: users, error: uErr } = await sb.from('users').select('id, auth_id, grade_level').limit(5);
  console.log("USERS:", users, uErr?.message);
}
check();
