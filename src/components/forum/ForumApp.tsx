"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ForumCategories from "./ForumCategories";
import ForumPosts from "./ForumPosts";
import ForumThread from "./ForumThread";
import AppAdminLoader from "@/components/AppAdminLoader";

export type ForumRole = "admin" | "parent" | "child";

interface ForumAppProps {
  role: ForumRole;
}

export default function ForumApp({ role }: ForumAppProps) {
  const [view, setView] = useState<"categories" | "posts" | "thread">("categories");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const [userAuthId, setUserAuthId] = useState<string | null>(null);
  const [userDbId, setUserDbId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const authId = data.session.user.id;
        setUserAuthId(authId);
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", authId)
          .single();
        if (userData) setUserDbId(userData.id);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  useEffect(() => {
    const urlView = searchParams.get("view") as "categories" | "posts" | "thread" | null;
    const categoryIdParam = searchParams.get("categoryId");
    const categoryNameParam = searchParams.get("categoryName");
    const postIdParam = searchParams.get("postId");

    if (!urlView) {
      setView("categories");
      return;
    }

    if (urlView === "posts" && categoryIdParam) {
      setView("posts");
      setSelectedCategoryId(Number(categoryIdParam));
      setSelectedCategoryName(categoryNameParam || "");
      setSelectedPostId(null);
      return;
    }

    if (urlView === "thread" && categoryIdParam && postIdParam) {
      setView("thread");
      setSelectedCategoryId(Number(categoryIdParam));
      setSelectedCategoryName(categoryNameParam || "");
      setSelectedPostId(Number(postIdParam));
    }
  }, [searchParams]);

  if (loading) {
    return <div className="p-12 flex justify-center"><AppAdminLoader /></div>;
  }

  if (!userAuthId) {
    return (
      <div className="p-8 text-center text-red-500">
        Vous devez être connecté pour accéder au forum.
      </div>
    );
  }

  const syncUrl = (params: Record<string, string | number | null | undefined>) => {
    const nextParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        nextParams.set(key, String(value));
      }
    });

    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const navigateToPosts = (categoryId: number, categoryName: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategoryName(categoryName);
    setSelectedPostId(null);
    setView("posts");
    syncUrl({ view: "posts", categoryId, categoryName });
  };

  const navigateToThread = (postId: number) => {
    setSelectedPostId(postId);
    setView("thread");
    syncUrl({ view: "thread", categoryId: selectedCategoryId, categoryName: selectedCategoryName, postId });
  };

  const backToCategories = () => {
    setView("categories");
    setSelectedCategoryId(null);
    setSelectedCategoryName("");
    setSelectedPostId(null);
    router.push(pathname);
  };

  const backToPosts = () => {
    setView("posts");
    setSelectedPostId(null);
    syncUrl({ view: "posts", categoryId: selectedCategoryId, categoryName: selectedCategoryName });
  };

  return (
    <div className="w-full">
      {view === "categories" && (
        <ForumCategories role={role} onSelectCategory={navigateToPosts} />
      )}

      {view === "posts" && selectedCategoryId && (
        <ForumPosts
          role={role}
          categoryId={selectedCategoryId}
          categoryName={selectedCategoryName}
          onSelectPost={navigateToThread}
          onBack={backToCategories}
        />
      )}

      {view === "thread" && selectedPostId && (
        <ForumThread
          role={role}
          postId={selectedPostId}
          userDbId={userDbId}
          onBack={backToPosts}
        />
      )}
    </div>
  );
}
