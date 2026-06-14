"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import { supabase } from "@/lib/supabaseClient";
import { BookOpen, Play, CheckCircle, Clock, Folder as FolderIcon, ChevronRight, Home, ArrowLeft } from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
import Link from "next/link";
import { getFolderIcon } from "@/lib/folderIcons";

export default function ChildCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("child_cours_folder");
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: number; name: string }[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, { status: string; pct: number }>>({});

  useEffect(() => {
    const fetchEverything = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let level = null;
        if (session) {
          const { data: userData } = await supabase
            .from("users")
            .select("grade_level")
            .eq("auth_id", session.user.id)
            .maybeSingle();
          level = userData?.grade_level || null;
        }

        // Fetch ALL Folders
        const folderUrl = `/api/child/folders?type=course${level ? `&level=${level}` : ""}&parent_id=all`;
        const folderRes = await fetch(folderUrl);
        if (folderRes.ok) {
          setAllFolders(await folderRes.json());
        }

        // Fetch ALL published courses
        const response = await fetch("/api/admin/courses?status=published");
        if (response.ok) {
          const allPublishedCourses = await response.json();
          let filtered = allPublishedCourses || [];
          if (level) {
            filtered = filtered.filter((c: any) => c.level?.toLowerCase() === level.toLowerCase());
          }
          setAllCourses(filtered);

          // Load progress from DB (fallback to localStorage) for each course
          const dbProgress: Record<string, { status: string; lessonsCompleted: string[] }> = {};
          if (session?.user) {
            try {
              const actRes = await fetch(`/api/child/activities?userId=${session.user.id}`);
              if (actRes.ok) {
                const act = await actRes.json();
                (act.courses || []).forEach((cp: any) => {
                  dbProgress[cp.course_id] = {
                    status: cp.status || "not_started",
                    lessonsCompleted: cp.progress_json?.lessonsCompleted || [],
                  };
                });
              }
            } catch (e) {
              console.error("Failed to load course progress", e);
            }
          }

          const prog: Record<string, { status: string; pct: number }> = {};
          for (const c of filtered) {
            const dbp = dbProgress[c.id];
            const status = dbp?.status || localStorage.getItem(`cv-${c.id}-status`) || "not_started";
            const done = dbp
              ? dbp.lessonsCompleted
              : (() => { try { return JSON.parse(localStorage.getItem(`cv-${c.id}-done`) || "[]"); } catch { return []; } })();
            const totalL = (c.content_json || []).reduce((a: number, ch: any) => a + (ch.lessons?.length || 0), 0);
            const pct = totalL > 0 ? Math.round((done.length / totalL) * 100) : 0;
            if (status !== "not_started" || pct > 0) prog[c.id] = { status, pct };
          }
          setCourseProgress(prog);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEverything();
  }, []);

  // Reconstruct breadcrumbs from the persisted folder id once folders are loaded
  useEffect(() => {
    if (allFolders.length === 0 || currentFolderId === null) return;
    const path: { id: number; name: string }[] = [];
    let f = allFolders.find((x) => x.id === currentFolderId);
    while (f) {
      path.unshift({ id: f.id, name: f.name });
      f = f.parent_id ? allFolders.find((x) => x.id === f.parent_id) : undefined;
    }
    setBreadcrumbs(path);
  }, [allFolders, currentFolderId]);

  // Handle LaTeX rendering whenever target items change
  const currentCourses = allCourses.filter(c => (c.folder_id ?? null) === currentFolderId);
  const currentFolders = allFolders.filter(f => f.parent_id === currentFolderId);

  useEffect(() => {
    if (loading || currentCourses.length === 0) return;

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
  }, [loading, currentCourses]);

  const navigateToFolder = (folderId: number, folderName: string) => {
    setIsRendering(true); // Pre-hide items for smooth transition
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
    setCurrentFolderId(folderId);
  };

  const navigateToBreadcrumb = (index: number) => {
    setIsRendering(true);
    if (index === -1) {
      setBreadcrumbs([]);
      setCurrentFolderId(null);
    } else {
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      setCurrentFolderId(breadcrumbs[index].id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppAdminLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-8 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
              <BookOpen className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
              MES COURS
            </h1>
            <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
              <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">LEÇONS</span>
              <span>Explore et deviens expert en mathématiques !</span>
            </p>
          </div>
        </div>
      </div>
    <div className="container mx-auto px-4 pb-12 max-w-6xl">

      <div className="space-y-8" ref={gridRef}>
        {/* Back Button */}
        {currentFolderId !== null && (
          <button
            onClick={() => navigateToBreadcrumb(breadcrumbs.length - 2)}
            className="flex items-center gap-2 text-[var(--greek-blue)] bg-white px-5 py-2.5 rounded-xl border border-[rgba(197,161,72,0.25)] shadow-sm hover:bg-blue-50 hover:-translate-x-1 transition-all duration-300 w-fit font-bold"
          >
            <ArrowLeft size={20} />
            Retour
          </button>
        )}

        {currentFolders.length === 0 && currentCourses.length === 0 ? (
          <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
            <BookOpen className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">
              Dossier vide
            </h3>
            <p className="text-gray-500">
              Reviens plus tard pour découvrir de nouveaux contenus !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Render Folders */}
            {currentFolders.map((folder, index) => {
              const FolderCardIcon = getFolderIcon(folder.icon);
              return (
              <div
                key={folder.id}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                className="group bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center aspect-[4/3] animate-fade-bounce"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${folder.color || "#3b82f6"}15`,
                    color: folder.color || "#3b82f6",
                  }}
                >
                  <FolderCardIcon size={40} fill="currentColor" fillOpacity={0.2} />
                </div>
                <h3 className="font-bold text-[var(--greek-blue)] text-xl w-full px-2">
                  {folder.name}
                </h3>
              </div>
              );
            })}

            {/* Render Courses */}
            {currentCourses.map((course, index) => {
              const prog = courseProgress[course.id];
              const isCompleted = prog?.status === "completed" || (prog?.pct ?? 0) >= 100;
              const isInProgress = !isCompleted && prog && prog.pct > 0;
              const totalL = (course.content_json || []).reduce((a: number, ch: any) => a + (ch.lessons?.length || 0), 0);
              const donePct = prog?.pct ?? 0;

              return (
              <div
                key={course.id}
                className={`group bg-white rounded-[20px] shadow-sm border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full animate-fade-bounce ${isRendering ? 'opacity-0' : 'opacity-100'} ${isCompleted ? 'border-green-400' : 'border-[rgba(197,161,72,0.25)]'}`}
                style={{ animationDelay: `${(currentFolders.length + index) * 40}ms` }}
              >
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <img src="/logo.png" alt="Educalcul" className="w-20 h-20 object-contain opacity-30 m-auto" />
                  )}
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-[var(--greek-blue)] shadow-sm">
                    {course.subject || "Mathématiques"}
                  </div>
                  {isCompleted && (
                    <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Terminé
                    </div>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                    {course.description || "Découvre ce chapitre passionnant !"}
                  </p>

                  {isInProgress && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{donePct}% complété</span>
                        {totalL > 0 && <span>{Math.round(donePct * totalL / 100)}/{totalL} leçons</span>}
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--greek-gold)] rounded-full transition-all" style={{ width: `${donePct}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-auto">
                    <Link
                      href={`/child/cours/${course.id}`}
                      className="w-full btn-primary-greek py-3 flex items-center justify-center gap-2 group-hover:bg-[var(--greek-gold)] group-hover:text-[var(--greek-blue)] transition-colors"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isCompleted ? "Revoir" : isInProgress ? "Reprendre" : "Commencer"}
                    </Link>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}


