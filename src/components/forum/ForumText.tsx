"use client";

import { useMemo } from "react";
import { renderUserText } from "@/lib/katexLoader";

/** Message du forum : texte brut échappé, formules $…$ rendues, gras **…**,
 * retours à la ligne conservés. */
export default function ForumText({ text, className = "" }: { text: string; className?: string }) {
  const html = useMemo(() => renderUserText(text), [text]);
  return (
    <div
      className={`whitespace-pre-wrap break-words leading-relaxed text-[15px] text-gray-700 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
