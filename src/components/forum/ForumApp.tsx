"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import ForumCategories from "./ForumCategories";
import ForumPosts from "./ForumPosts";
import ForumThread from "./ForumThread";
import { Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUserAuthId(data.session.user.id);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!userAuthId) {
    return (
      <div className="p-8 text-center text-red-500">
        Vous devez être connecté pour accéder au forum.
      </div>
    );
  }

  const navigateToPosts = (categoryId: number, categoryName: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategoryName(categoryName);
    setView("posts");
  };

  const navigateToThread = (postId: number) => {
    setSelectedPostId(postId);
    setView("thread");
  };

  const goBack = () => {
    if (view === "thread") setView("posts");
    else if (view === "posts") setView("categories");
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
          userAuthId={userAuthId}
          onBack={() => setView("categories")}
        />
      )}

      {view === "thread" && selectedPostId && (
        <ForumThread 
          role={role}
          postId={selectedPostId}
          userAuthId={userAuthId}
          onBack={() => setView("posts")}
        />
      )}
    </div>
  );
}
