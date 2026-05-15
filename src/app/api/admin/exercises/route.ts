import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const id = searchParams.get("id");
    const courseId = searchParams.get("course_id");

    if (id) {
      let { data, error } = await supabaseAdmin
        .from("exercises")
        .select(`
          id,
          title,
          description,
          question,
          difficulty_level,
          type,
          level,
          content_json,
          status,
          created_at,
          updated_at,
          course_id,
          points,
          courses (title, subject, level),
          exercise_folders (name, color)
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching single exercise:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      if (!data) {
        return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
      }
      
      // Ensure content_json is never empty
      if (!data.content_json || (Array.isArray(data.content_json) && data.content_json.length === 0)) {
        const fallbackQuestion = data.question || data.description || data.title || "Énoncé non spécifié";
        
        // Create appropriate default block based on exercise type
        let defaultBlock: any = {
          id: "block-1",
          type: "text",
          content: fallbackQuestion,
        };

        if (data.type === "single_choice" || data.type === "multiple_choice") {
          defaultBlock = {
            id: "block-1",
            type: data.type === "multiple_choice" ? "multiple_choice" : "single_choice",
            content: fallbackQuestion,
            options: [
              { id: "opt-1", text: "Réponse A" },
              { id: "opt-2", text: "Réponse B" },
              { id: "opt-3", text: "Réponse C" },
            ],
            correctAnswer: "opt-1",
          };
        } else if (data.type === "true_false") {
          defaultBlock = {
            id: "block-1",
            type: "true_false",
            statement: fallbackQuestion,
            correctAnswer: true,
          };
        } else if (data.type === "text_input") {
          defaultBlock = {
            id: "block-1",
            type: "text_input",
            label: fallbackQuestion,
            placeholder: "Votre réponse",
            expectedAnswer: "",
          };
        }

        data.content_json = [
          {
            id: "page-1",
            blocks: [defaultBlock],
          },
        ];
        console.log("✅ Filled empty content_json with fallback:", {
          id: data.id,
          title: data.title,
          type: data.type,
        });
      }
      
      return NextResponse.json(data);
    }

    let query = supabaseAdmin
      .from("exercises")
      .select(
        `
        id,
        title,
        description,
        question,
        difficulty_level,
        type,
        level,
        content_json,
        status,
        created_at,
        course_id,
        courses (title, subject, level),
        exercise_folders (name, color)
      `
      )
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (courseId && courseId !== "all") {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching exercises:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Ensure content_json is filled for all exercises
    const processedData = data.map((exercise: any) => {
      if (!exercise.content_json || (Array.isArray(exercise.content_json) && exercise.content_json.length === 0)) {
        const fallbackQuestion = exercise.question || exercise.description || exercise.title || "Énoncé non spécifié";
        
        // Create appropriate default block based on exercise type
        let defaultBlock: any = {
          id: "block-1",
          type: "text",
          content: fallbackQuestion,
        };

        if (exercise.type === "single_choice" || exercise.type === "multiple_choice") {
          defaultBlock = {
            id: "block-1",
            type: exercise.type === "multiple_choice" ? "multiple_choice" : "single_choice",
            content: fallbackQuestion,
            options: [
              { id: "opt-1", text: "Réponse A" },
              { id: "opt-2", text: "Réponse B" },
              { id: "opt-3", text: "Réponse C" },
            ],
            correctAnswer: "opt-1",
          };
        } else if (exercise.type === "true_false") {
          defaultBlock = {
            id: "block-1",
            type: "true_false",
            statement: fallbackQuestion,
            correctAnswer: true,
          };
        } else if (exercise.type === "text_input") {
          defaultBlock = {
            id: "block-1",
            type: "text_input",
            label: fallbackQuestion,
            placeholder: "Votre réponse",
            expectedAnswer: "",
          };
        }

        return {
          ...exercise,
          content_json: [
            {
              id: "page-1",
              blocks: [defaultBlock],
            },
          ],
        };
      }
      return exercise;
    });

    return NextResponse.json(processedData);
  } catch (error: any) {
    console.error("Error fetching exercises:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      course_id,
      difficulty_level,
      type,
      level,
      status,
      folder_id,
      thumbnail_url,
      content_json,
      time_limit,
      max_attempts,
    } = body;

    // If content_json is empty or not provided, create a sensible default based on exercise type
    let finalContentJson = content_json || [];
    if (!finalContentJson || finalContentJson.length === 0) {
      // Create a default page with appropriate block based on exercise type
      let defaultBlock: any = {
        id: "block-1",
        type: "text",
        content: description || title || "Énoncé non spécifié",
      };

      // Add type-specific defaults
      if (type === "single_choice" || type === "multiple_choice") {
        defaultBlock = {
          id: "block-1",
          type: type === "multiple_choice" ? "multiple_choice" : "single_choice",
          content: description || title || "Question",
          options: [
            { id: "opt-1", text: "Réponse A" },
            { id: "opt-2", text: "Réponse B" },
            { id: "opt-3", text: "Réponse C" },
          ],
          correctAnswer: "opt-1",
        };
      } else if (type === "true_false") {
        defaultBlock = {
          id: "block-1",
          type: "true_false",
          statement: description || title || "Énoncé du vrai/faux",
          correctAnswer: true,
        };
      } else if (type === "text_input") {
        defaultBlock = {
          id: "block-1",
          type: "text_input",
          label: description || title || "Répondez à la question",
          placeholder: "Votre réponse",
          expectedAnswer: "",
        };
      }

      finalContentJson = [
        {
          id: "page-1",
          blocks: [defaultBlock],
        },
      ];
      console.log("✅ Created default content_json for type:", {
        title,
        type,
        hasDescription: !!description,
      });
    } else {
      console.log("✅ Using provided content_json:", {
        title,
        type,
        pagesCount: finalContentJson.length,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("exercises")
      .insert({
        title,
        question: description,
        course_id,
        difficulty_level,
        type,
        level: level || "6eme",
        status: status || "draft",
        is_published: status === "published" || status === "active",
        folder_id: folder_id || null,
        thumbnail_url,
        content_json: finalContentJson,
        time_limit: time_limit || null,
        max_attempts: max_attempts || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, exercise: data });
  } catch (error: any) {
    console.error("Error creating exercise:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      course_id,
      difficulty_level,
      type,
      level,
      status,
      folder_id,
      thumbnail_url,
      content_json,
      time_limit,
      max_attempts,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Exercise ID is required" },
        { status: 400 }
      );
    }

    // If content_json is empty or not provided, create a default structure based on type
    let finalContentJson = content_json;
    if (!finalContentJson || (Array.isArray(finalContentJson) && finalContentJson.length === 0)) {
      // Create appropriate default block based on exercise type
      let defaultBlock: any = {
        id: "block-1",
        type: "text",
        content: description || title || "Énoncé non spécifié",
      };

      if (type === "single_choice" || type === "multiple_choice") {
        defaultBlock = {
          id: "block-1",
          type: type === "multiple_choice" ? "multiple_choice" : "single_choice",
          content: description || title || "Question",
          options: [
            { id: "opt-1", text: "Réponse A" },
            { id: "opt-2", text: "Réponse B" },
            { id: "opt-3", text: "Réponse C" },
          ],
          correctAnswer: "opt-1",
        };
      } else if (type === "true_false") {
        defaultBlock = {
          id: "block-1",
          type: "true_false",
          statement: description || title || "Énoncé du vrai/faux",
          correctAnswer: true,
        };
      } else if (type === "text_input") {
        defaultBlock = {
          id: "block-1",
          type: "text_input",
          label: description || title || "Répondez à la question",
          placeholder: "Votre réponse",
          expectedAnswer: "",
        };
      }

      finalContentJson = [
        {
          id: "page-1",
          blocks: [defaultBlock],
        },
      ];
      console.log("✅ Created default content_json from description (UPDATE):", {
        title,
        type,
        hasDescription: !!description,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("exercises")
      .update({
        title,
        question: description,
        course_id,
        difficulty_level,
        type,
        level,
        status,
        is_published: status === "published" || status === "active",
        folder_id: folder_id || null,
        thumbnail_url,
        content_json: finalContentJson,
        time_limit: time_limit || null,
        max_attempts: max_attempts || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, exercise: data });
  } catch (error: any) {
    console.error("Error updating exercise:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Exercise ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("exercises")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
