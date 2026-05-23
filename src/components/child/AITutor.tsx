"use client";

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { useAITutor } from "@/contexts/AITutorContext";
import { Send, X, Minus, Star, RotateCcw, Sparkles, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useSubscription, canUseAI, aiRemaining } from "@/lib/useSubscription";
import { renderLatexInHTML } from "@/lib/katexLoader";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Salut ! Je suis **Athéna**, ta tutrice IA.\n\nJe suis là pour t'aider à comprendre tes cours et tes exercices — mais je ne donnerai jamais la réponse directement ! C'est toi qui réfléchis, moi je guide. Qu'est-ce qui te pose problème ?",
};


function renderContent(text: string) {
  // 1. Convertir les backticks contenant du LaTeX en délimiteurs $...$
  //    ex: `\frac{1}{2}` → $\frac{1}{2}$
  let processed = text.replace(/`(\\[^`]+)`/g, (_, math) => `$${math}$`);
  // 2. Pré-rendre tout le LaTeX
  const withLatex = renderLatexInHTML(processed);
  // 3. Gras markdown
  const withBold = withLatex.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-black" style="color:var(--greek-blue)">$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: withBold }} />;
}

export default function AITutor() {
  const { pageContext } = useAITutor();
  const sub = useSubscription();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [authId, setAuthId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthId(data.user?.id ?? null));
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!open) return;
      if (
        chatPanelRef.current?.contains(e.target as Node) ||
        floatBtnRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const floatBtnRef = useRef<HTMLButtonElement>(null);
  
  // Refs to store latest state for event listeners
  const messagesRef = useRef<Message[]>([WELCOME]);
  const pageContextRef = useRef(pageContext);
  const saveMessagesRef = useRef<(msgs: Message[]) => void>(() => {});

  // Get unique key for this exercise/course/quiz
  const getContextKey = useCallback(() => {
    if (pageContext.exerciseTitle) return `exercise-${pageContext.exerciseTitle}`;
    if (pageContext.courseTitle) return `course-${pageContext.courseTitle}`;
    if (pageContext.quizTitle) return `quiz-${pageContext.quizTitle}`;
    return "default";
  }, [pageContext.exerciseTitle, pageContext.courseTitle, pageContext.quizTitle]);

  // Save messages to localStorage
  const saveMessages = useCallback((msgs: Message[]) => {
    try {
      const key = `athena-chat-${getContextKey()}`;
      localStorage.setItem(key, JSON.stringify(msgs));
    } catch (e) {
      // Silently fail if localStorage is blocked by Tracking Prevention
      // The chat will still work, just won't persist between reloads
    }
  }, [getContextKey()]);

  // Update refs whenever state changes
  useEffect(() => {
    messagesRef.current = messages;
    pageContextRef.current = pageContext;
    saveMessagesRef.current = saveMessages;
  }, [messages, pageContext, saveMessages]);

  // Load messages from localStorage
  const loadMessages = useCallback(() => {
    try {
      const key = `athena-chat-${getContextKey()}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load chat:", e);
    }
    return [WELCOME];
  }, [getContextKey()]);


  // Load saved messages when exercise changes
  useEffect(() => {
    const loaded = loadMessages();
    setMessages(loaded);
  }, [loadMessages]);

  // Render math après chaque nouveau message

  // Listen for text selection from CourseViewer with polling
  useEffect(() => {
    let lastTimestamp = 0;
    const interval = setInterval(() => {
      const pending = (window as any).__pendingAIQuestion;
      if (pending && pending.timestamp > lastTimestamp) {
        lastTimestamp = pending.timestamp;
        const { message } = pending;
        
        if (message) {
          console.log("📋 Received pending AI question:", message.slice(0, 50));
          
          // Use refs to get latest state
          const currentMessages = messagesRef.current;
          const currentContext = pageContextRef.current;
          const currentSaveMessages = saveMessagesRef.current;
          
          // Add user message
          const userMsg: Message = { role: "user", content: message };
          const newMessages = [...currentMessages, userMsg];
          
          // Update state and save
          setMessages(newMessages);
          currentSaveMessages(newMessages);
          
          // Open chat
          setOpen(true);
          setMinimized(false);
          
          // Send message to AI
          setLoading(true);
          
          setTimeout(async () => {
            try {
              const res = await fetch("/api/child/ai-tutor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  messages: newMessages.slice(-10),
                  context: currentContext
                }),
              });
              
              const data = await res.json();
              const finalMessages = [
                ...newMessages,
                { role: "assistant" as const, content: data.message || "Je suis là ! Réessaie." },
              ];
              setMessages(finalMessages as any);
              currentSaveMessages(finalMessages as any);
            } catch (error) {
              console.error("Error sending AI message:", error);
            } finally {
              setLoading(false);
            }
          }, 100);
        }
      }
    }, 100); // Check every 100ms
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open && !minimized) {
      // Force scroll after a delay to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, minimized]);

  // Reset chat when navigating to a new piece of content
  const lastContextKey = useRef("");
  useEffect(() => {
    const key = `${pageContext.page}|${pageContext.courseTitle || ""}|${pageContext.exerciseTitle || ""}|${pageContext.quizTitle || ""}`;
    if (key === lastContextKey.current) return;
    lastContextKey.current = key;

    const name =
      pageContext.courseTitle ||
      pageContext.exerciseTitle ||
      pageContext.quizTitle;

    if (
      name &&
      (pageContext.page === "cours_detail" ||
        pageContext.page === "exercise_detail" ||
        pageContext.page === "quiz_detail")
    ) {
      const newMessages = [
        WELCOME,
        {
          role: "assistant" as const,
          content: `Je vois que tu travailles sur **${name}** 📚\nN'hésite pas à me poser une question si tu bloques !`,
        },
      ];
      setMessages(newMessages as any);
      saveMessages(newMessages as any);
    }
  }, [pageContext, saveMessages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    saveMessages(history);
    setInput("");
    setLoading(true);

    console.log("📤 Sending message to AI:", {
      userMessage: input.trim().slice(0, 50),
      messagesCount: history.length,
      exerciseTitle: pageContext.exerciseTitle,
    });

    try {
      // Log context BEFORE sending - with full details
      console.log("📤 Sending to AI Tutor - FULL CONTEXT:", {
        page: pageContext.page,
        exerciseTitle: pageContext.exerciseTitle,
        exerciseQuestion: pageContext.exerciseQuestion?.slice(0, 150) || "NO QUESTION",
        exerciseType: pageContext.exerciseType,
        courseTitle: pageContext.courseTitle,
        courseSubject: pageContext.courseSubject,
        courseLevel: pageContext.courseLevel,
        hasQuestion: !!pageContext.exerciseQuestion,
        questionLength: pageContext.exerciseQuestion?.length || 0,
        hasUserAnswer: !!pageContext.userAnswer,
        entireContext: pageContext, // Log the entire context object
      });

      const res = await fetch("/api/child/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authId ? { "x-user-auth-id": authId } : {}) },
        body: JSON.stringify({ messages: history.slice(-10), context: pageContext }),
      });

      const data = await res.json();

      // Blocked by subscription
      if (res.status === 403 && data.blocked) {
        const newMessages = [...history, { role: "assistant" as const, content: `${data.reason}` }];
        setMessages(newMessages);
        saveMessages(newMessages);
        setLoading(false);
        return;
      }

      const newMessages = [
        ...history,
        { role: "assistant" as const, content: data.message || "Je suis là ! Réessaie." },
      ];
      console.log("💾 Saving messages:", { count: newMessages.length });
      setMessages(newMessages as any);
      saveMessages(newMessages as any);
    } catch (error) {
      console.error("❌ Fetch error:", error);
      const newMessages = [
        ...history,
        { role: "assistant" as const, content: "Oups, je n'ai pas pu répondre. Essaie encore !" },
      ];
      setMessages(newMessages as any);
      saveMessages(newMessages as any);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, pageContext, saveMessages]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const contextLabel =
    pageContext.courseTitle ||
    pageContext.exerciseTitle ||
    pageContext.quizTitle;

  return (
    <>
      {/* ── Floating button — always visible ── */}
      <button
        ref={floatBtnRef}
        onClick={() => {
          setOpen((v) => !v);
          setMinimized(false);
          setHasOpened(true);
        }}
        aria-label="Ouvrir Athéna"
        className={`fixed bottom-28 md:bottom-6 right-4 md:right-6 z-50 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 select-none group
          bg-[var(--greek-blue)] hover:bg-blue-800
          ${open ? "scale-90" : "hover:scale-110 hover:-translate-y-1"}
          ${!hasOpened && !sub.loading && sub.features.ai_access !== "none" ? "animate-bounce-slow" : ""}
        `}
      >
        {!hasOpened && !sub.loading && sub.features.ai_access !== "none" && (
          <span className="absolute inset-0 rounded-full border-2 border-[var(--greek-gold)] animate-ping opacity-60" />
        )}
        {!sub.loading && sub.features.ai_access === "limited" && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--greek-gold)] rounded-full text-[10px] font-black text-[var(--greek-blue)] flex items-center justify-center shadow">
            {aiRemaining(sub)}
          </span>
        )}
        {!sub.loading && sub.features.ai_access === "none" && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow">
            <Lock className="w-3 h-3 text-white" />
          </span>
        )}
        {open ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <>
            <Star className="w-8 h-8 text-[var(--greek-gold)] fill-current" />
            <span className="absolute bottom-full right-0 mb-3 whitespace-nowrap bg-[var(--greek-blue)] text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-widest">
              {sub.features.ai_access === "none" ? "Athéna IA — Abonnement requis" :
               sub.features.ai_access === "limited" ? `Athéna IA · ${aiRemaining(sub)} restants` : "Athéna IA"}
            </span>
          </>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          ref={chatPanelRef}
          className={`fixed bottom-36 md:bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[370px] max-w-[calc(100vw-1.5rem)]
            bg-white rounded-[24px] shadow-2xl border border-[rgba(197,161,72,0.25)]
            flex flex-col overflow-hidden transition-all duration-300 animate-fade-in
            ${minimized ? "h-[68px]" : "h-[540px]"}
          `}
        >
          {/* ── Header ── */}
          <div className="bg-[var(--greek-blue)] px-5 py-3.5 flex items-center justify-between shrink-0 relative overflow-hidden">
            {/* blur orbs */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-2xl bg-[var(--greek-gold)] flex items-center justify-center shadow-lg shrink-0">
                <Star className="w-5 h-5 text-[var(--greek-blue)] fill-current" />
              </div>
              <div>
                <div className="text-white font-[family-name:var(--font-display)] font-bold text-base tracking-wider leading-none">
                  ATHÉNA
                </div>
                <div className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-0.5">
                  Tutrice IA · Maths
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-1.5">
              <button
                onClick={() => {
                  setOpen(false);
                  setMinimized(false);
                }}
                className="text-white/50 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"
                title="Fermer"
                aria-label="Fermer Athéna"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setMessages([WELCOME]);
                  saveMessages([WELCOME]);
                }}
                className="text-white/50 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"
                title="Nouvelle conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMinimized((v) => !v)}
                className="text-white/50 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* ── Context chip ── */}
              {contextLabel && (
                <div className="px-4 pt-3 shrink-0 max-h-12 overflow-hidden">
                  <div className="flex items-center gap-2 bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-xl px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-[10px] text-[var(--greek-bronze)] font-black uppercase tracking-widest truncate">
                      {contextLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Messages ── */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 bg-white flex flex-col"
                style={{ contain: 'layout' }}
              >
                {messages && messages.length > 0 ? (
                  <>
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"} w-full animate-fade-in`}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-7 h-7 rounded-xl bg-[var(--greek-gold)] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <Star className="w-3.5 h-3.5 text-[var(--greek-blue)] fill-current" />
                          </div>
                        )}
                        <div
                          className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${
                            msg.role === "user"
                              ? "bg-[var(--greek-blue)] text-white font-bold rounded-br-sm shadow-sm"
                              : "bg-[var(--greek-cream)] text-gray-700 rounded-bl-sm border border-[rgba(197,161,72,0.25)]"
                          }`}
                        >
                          {renderContent(msg.content)}
                        </div>
                        {msg.role === "user" && (
                          <div className="w-7 h-7 rounded-xl bg-[var(--greek-blue)] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <span className="text-white text-[10px] font-black">Toi</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    Aucun message pour le moment
                  </div>
                )}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-xl bg-[var(--greek-gold)] flex items-center justify-center shrink-0 shadow-sm">
                      <Star className="w-3.5 h-3.5 text-[var(--greek-blue)] fill-current" />
                    </div>
                    <div className="bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center">
                      <span className="w-2 h-2 bg-[var(--greek-gold)] rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-[var(--greek-gold)] rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-[var(--greek-gold)] rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Quick suggestions ── */}
              {messages.length <= 2 && (
                <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
                  {["Je ne comprends pas", "Donne-moi un indice", "Comment naviguer ?"].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="text-[11px] bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] hover:border-[var(--greek-gold)] hover:bg-[var(--greek-gold)]/10 text-[var(--greek-bronze)] font-black px-3 py-1.5 rounded-full transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Input or upgrade prompt ── */}
              {sub.features.ai_access === "none" ? (
                <div className="px-4 pb-4 pt-2 shrink-0 border-t border-[rgba(197,161,72,0.25)]">
                  <div className="bg-gradient-to-br from-[var(--greek-blue)]/5 to-[var(--greek-gold)]/5 border border-[rgba(197,161,72,0.25)] rounded-2xl p-4 text-center">
                    <Lock className="w-6 h-6 text-[var(--greek-gold)] mx-auto mb-2" />
                    <p className="text-sm font-bold text-[var(--greek-blue)] mb-1">Athéna IA — Plan requis</p>
                    <p className="text-xs text-gray-500 mb-3">L'assistant IA est disponible à partir du plan Premium.</p>
                    <a href="/parent/subscription" className="flex items-center justify-center gap-1.5 bg-[var(--greek-blue)] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-800 transition-colors">
                      Voir les abonnements <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="px-4 pb-4 pt-2 shrink-0 border-t border-[rgba(197,161,72,0.25)]">
                  <div className="flex gap-2 items-end bg-[var(--greek-cream)] border-2 border-transparent focus-within:border-[var(--greek-gold)] rounded-2xl p-2 transition-all">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder="Pose ta question ici…"
                      rows={1}
                      className="flex-1 bg-transparent text-gray-800 text-sm placeholder:text-gray-400 outline-none resize-none max-h-24 py-1 px-1 font-medium leading-relaxed"
                      style={{ minHeight: "34px" }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || loading}
                      className="w-9 h-9 rounded-xl bg-[var(--greek-blue)] text-white flex items-center justify-center shrink-0
                        hover:bg-blue-800 disabled:opacity-30 disabled:cursor-not-allowed
                        transition-all shadow-sm hover:scale-105 active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  {sub.features.ai_access === "limited" ? (
                    <p className="text-center text-gray-400 text-[9px] mt-1 font-bold">
                      {aiRemaining(sub)} message{aiRemaining(sub) !== 1 ? "s" : ""} restant{aiRemaining(sub) !== 1 ? "s" : ""} aujourd'hui
                    </p>
                  ) : (
                    <p className="text-center text-gray-300 text-[9px] mt-1.5 font-bold uppercase tracking-widest">
                      Entrée pour envoyer · Shift+Entrée pour sauter une ligne
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
