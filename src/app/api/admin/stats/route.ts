import { createClient } from "@supabase/supabase-js";
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET() {
  try {
    // Execute counts in parallel
    const [
      { count: usersCount, error: usersError },
      { count: subsCount, error: subsError },
      { count: coursesCount, error: coursesError },
      { count: exercisesCount, error: exercisesError },
      { count: quizzesCount, error: quizzesError }
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      supabaseAdmin.from('exercises').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('quizzes').select('*', { count: 'exact', head: true })
    ]);

    if (usersError) console.error("Error counting users:", usersError);
    if (subsError) console.error("Error counting subscriptions:", subsError);
    if (coursesError) console.error("Error counting courses:", coursesError);

    return NextResponse.json({
      users: usersCount || 0,
      active_subscriptions: subsCount || 0,
      published_courses: coursesCount || 0,
      exercises: exercisesCount || 0,
      quizzes: quizzesCount || 0
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
