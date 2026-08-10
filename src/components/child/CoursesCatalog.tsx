"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import { BookOpen, Play, CheckCircle, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { getFolderIcon } from "@/lib/folderIcons";
import GlassButton from "@/components/ui/GlassButton";

interface FolderRow { id: number; parent_id: number | null; name: string; color?: string; icon?: string; grade_level?: string }
interface CourseRow {
  id: string; folder_id: number | null; title: string; description?: string;
  thumbnail_url?: string; subject?: string; lesson_count?: number;
}
type CourseProgress = Record<string, { status: string; pct: number }>;

/** Navigation par dossiers + grille de cours. Données chargées côté serveur ;
 * reste un client island pour la navigation instantanée entre dossiers
 * (sessionStorage) et le rendu KaTeX des titres/descriptions (chargé depuis
 * un CDN au montage, comme avant). */
export default function CoursesCatalog({
  allFolders, allCourses, levelFolderId, courseProgress,
}: {
  allFolders: FolderRow[];
  allCourses: CourseRow[];
  levelFolderId: number | null;
  courseProgress: CourseProgress;
}) {
  const [isRendering, setIsRendering] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("child_cours_folder");
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (allFolders.length === 0 || currentFolderId === null) {
      setBreadcrumbs([]);
      return;
    }
    const path: { id: number; name: string }[] = [];
    let f = allFolders.find((x) => x.id === currentFolderId);
    while (f && f.id !== levelFolderId) {
      path.unshift({ id: f.id, name: f.name });
      const parentId = f.parent_id;
      f = parentId ? allFolders.find((x) => x.id === parentId) : undefined;
    }
    setBreadcrumbs(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFolders, currentFolderId, levelFolderId]);

  const displayParentId = currentFolderId === null ? levelFolderId : currentFolderId;
  const currentCourses = allCourses.filter((c) => (c.folder_id ?? null) === displayParentId);
  const currentFolders = allFolders.filter((f) => f.parent_id === displayParentId);

  useEffect(() => {
    if (currentCourses.length === 0) return;

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
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
            ],
            throwOnError: false,
          });
        } finally {
          setTimeout(() => setIsRendering(false), 50);
        }
      }
    };

    const timer = setTimeout(loadKatex, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCourses]);

  const navigateToFolder = (folderId: number, folderName: string) => {
    setIsRendering(true);
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

  return (
    <div className="space-y-8" ref={gridRef}>
      {currentFolderId !== null && (
        <GlassButton
          onClick={() => navigateToBreadcrumb(breadcrumbs.length - 2)}
          variant="outline" size="sm"
        >
          <ArrowLeft size={20} />
          Retour
        </GlassButton>
      )}

      {currentFolders.length === 0 && currentCourses.length === 0 ? (
        <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
          <BookOpen className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Dossier vide</h3>
          <p className="text-gray-500">Reviens plus tard pour découvrir de nouveaux contenus !</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {currentFolders.map((folder, index) => {
            const FolderCardIcon = getFolderIcon(folder.icon);
            return (
              <div
                key={folder.id}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigateToFolder(folder.id, folder.name);
                  }
                }}
                className="group bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center aspect-[4/3] animate-fade-bounce"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${folder.color || "#3b82f6"}15`, color: folder.color || "#3b82f6" }}
                >
                  <FolderCardIcon size={40} fill="currentColor" fillOpacity={0.2} />
                </div>
                <h3 className="font-bold text-[var(--greek-blue)] text-xl w-full px-2">{folder.name}</h3>
              </div>
            );
          })}

          {currentCourses.map((course, index) => {
            const prog = courseProgress[course.id];
            const isCompleted = prog?.status === "completed" || (prog?.pct ?? 0) >= 100;
            const isInProgress = !isCompleted && prog && prog.pct > 0;
            const totalL = course.lesson_count ?? 0;
            const donePct = prog?.pct ?? 0;

            return (
              <div
                key={course.id}
                className={`group bg-white rounded-[20px] shadow-sm border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full animate-fade-bounce ${isRendering ? "opacity-0" : "opacity-100"} ${isCompleted ? "border-green-400" : "border-[rgba(197,161,72,0.25)]"}`}
                style={{ animationDelay: `${(currentFolders.length + index) * 40}ms` }}
              >
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  {course.thumbnail_url ? (
                    <Image src={course.thumbnail_url} alt={course.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <Image src="/logo.png" alt="Vignette par défaut du cours" width={80} height={80} className="w-20 h-20 object-contain opacity-30 m-auto" />
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
                  <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">{course.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                    {course.description || "Découvre ce chapitre passionnant !"}
                  </p>

                  {isInProgress && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{donePct}% complété</span>
                        {totalL > 0 && <span>{Math.round((donePct * totalL) / 100)}/{totalL} leçons</span>}
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--greek-gold)] rounded-full transition-all" style={{ width: `${donePct}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-auto">
                    <GlassButton
                      href={`/child/cours/${course.id}`}
                      variant="navy" fullWidth size="sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isCompleted ? "Revoir" : isInProgress ? "Reprendre" : "Commencer"}
                    </GlassButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
