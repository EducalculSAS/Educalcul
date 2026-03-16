import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Execute the SQL to enable RLS
    const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql_query: `
            -- Enable RLS on courses table if not already enabled
            ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

            -- Allow public read access to courses (since they are educational content)
            DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.courses;
            CREATE POLICY "Enable read access for all authenticated users"
            ON public.courses
            FOR SELECT
            TO authenticated
            USING (true);

            -- Enable RLS on quizzes table
            ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

            -- Allow read access to quizzes for authenticated users
            DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.quizzes;
            CREATE POLICY "Enable read access for all authenticated users"
            ON public.quizzes
            FOR SELECT
            TO authenticated
            USING (true);
        `
    })

    if (error) {
       // RPC might not exist, try to just ignore if we can't run SQL directly
       // This is a limitation if we don't have direct SQL access via API without a helper function
       console.error("Failed to exec SQL via RPC:", error)
       return NextResponse.json({ error: "Failed to apply policies" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
