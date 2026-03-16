"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BookOpen, Play, CheckCircle, Clock } from "lucide-react";
import MathLoader from "@/components/MathLoader";
import Link from "next/link";

export default function ChildCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      // Fetch all courses with folders
      const { data: coursesData, error } = await supabase
        .from("courses")
        .select(
          `
          id, 
          title, 
          description, 
          thumbnail_url, 
          subject,
          folder_id,
          course_folders (
            id,
            name,
            color
          )
        `
        )
        .eq("status", "published")
        .order("title");

      if (error) {
        if (error.code !== "PGRST116") {
          console.error("Error fetching courses:", error);
        }
      } else {
        setCourses(coursesData || []);
      }
      setLoading(false);
    };

    fetchCourses();
  }, []);

  // Handle LaTeX rendering for the course cards
  useEffect(() => {
    if (loading || courses.length === 0) return;

    const loadKatex = async () => {
      if (!document.getElementById("katex-css")) {
        const link = document.createElement("link");
        link.id = "katex-css";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.rel = "stylesheet";
        link.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }

      const loadScript = (src: string, integrity: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          if ((window as any).katex && src.includes("katex.min.js")) return resolve();
          if ((window as any).renderMathInElement && src.includes("auto-render.min.js")) return resolve();
          const script = document.createElement("script");
          script.src = src;
          script.integrity = integrity;
          script.crossOrigin = "anonymous";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(script);
        });
      };

      try {
        await loadScript("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js", "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8");
        await loadScript("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js", "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05");
        renderMath();
      } catch (err) { console.error(err); }
    };

    const renderMath = () => {
      if (gridRef.current && (window as any).renderMathInElement) {
        setIsRendering(true);
        try {
          (window as any).renderMathInElement(gridRef.current, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false}
            ],
            throwOnError: false
          });
        } finally {
          setTimeout(() => setIsRendering(false), 50);
        }
      }
    };

    const timer = setTimeout(loadKatex, 100);
    return () => clearTimeout(timer);
  }, [loading, courses]);

  // Group courses by folder
  const groupedCourses = courses.reduce((acc, course) => {
    const folderName = (course as any).course_folders?.name || "Autres Cours";
    const folderColor = (course as any).course_folders?.color || "#6c757d";
    const folderId = (course as any).course_folders?.id || "uncategorized";

    if (!acc[folderId]) {
      acc[folderId] = {
        name: folderName,
        color: folderColor,
        courses: [],
      };
    }
    acc[folderId].courses.push(course);
    return acc;
  }, {} as Record<string, { name: string; color: string; courses: any[] }>);

  const sortedGroups = Object.values(groupedCourses).sort((a: any, b: any) => {
    if (a.name === "Autres Cours") return 1;
    if (b.name === "Autres Cours") return -1;
    return (a.name as string).localeCompare(b.name as string);
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm">
          <BookOpen className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Mes Cours
        </h1>
        <p className="text-gray-600 text-lg">
          Explore tes leçons et deviens un expert en mathématiques !
        </p>
      </div>

      <div className="space-y-12" ref={gridRef}>
        {sortedGroups.length === 0 && courses.length === 0 ? (
          <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[var(--greek-gold)]/20">
            <BookOpen className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">
              Aucun cours disponible
            </h3>
            <p className="text-gray-500">
              Reviens plus tard pour découvrir de nouveaux contenus !
            </p>
          </div>
        ) : (
          sortedGroups.map((group: any) => (
            <div key={group.name} className="space-y-6">
              <div className="flex items-center gap-3 border-b border-[var(--greek-gold)]/20 pb-2">
                <div
                  className="w-1.5 h-8 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <h2 className="text-2xl font-bold text-[var(--greek-blue)]">
                  {group.name}
                </h2>
                <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {group.courses.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {group.courses.map((course: any) => (
                  <div
                    key={course.id}
                    className={`group bg-white rounded-[20px] shadow-sm border border-[var(--card-border-antique)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full ${isRendering ? 'opacity-0' : 'opacity-100'}`}
                  >
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[var(--greek-blue)]/5">
                          <BookOpen className="w-16 h-16 text-[var(--greek-blue)] opacity-20" />
                        </div>
                      )}
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-[var(--greek-blue)] shadow-sm">
                        {course.subject || "Mathématiques"}
                      </div>
                    </div>

                    <div className="p-6 flex flex-col flex-grow">
                      <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-grow">
                        {course.description ||
                          "Découvre ce chapitre passionnant !"}
                      </p>

                      <div className="mt-auto">
                        <Link
                          href={`/child/cours/${course.id}`}
                          className="w-full btn-primary-greek py-3 flex items-center justify-center gap-2 group-hover:bg-[var(--greek-gold)] group-hover:text-[var(--greek-blue)] transition-colors"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Commencer
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
