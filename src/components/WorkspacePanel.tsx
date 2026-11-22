"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  BookOpen,
  Camera,
  RotateCw,
  Image as ImageIcon,
  AlertCircle,
  Upload,
  ChevronDown,
  ChevronUp,
  Clock,
  Timer,
  RefreshCw,
} from "lucide-react";
import confetti from "canvas-confetti";
import { StudentSlot, StudentProgress, TutorMessage, RoadmapExercise } from "@/types";
import { soundService } from "@/lib/audio";
import { syncEngine } from "@/lib/supabase";
import { TutorContentFormatter } from "@/components/TutorContentFormatter";

/**
 * Client-side Canvas Image Compression
 * Scales max dimension to 1280px, converts to JPEG 0.7 quality (< 200KB)
 * Bypasses Supabase Storage completely and prevents quota overage.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const maxWidth = 1280;
        const maxHeight = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG quality 0.7 (< 200KB)
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

interface WorkspacePanelProps {
  roomCode: string;
  currentExercise: number;
  roadmap: RoadmapExercise[];
  mySlot: StudentSlot;
  myProgress: StudentProgress;
  setMyProgress: React.Dispatch<React.SetStateAction<StudentProgress>>;
  sourceTitle: string;
  onOpenUpload: () => void;
  onStartCustomTopic?: (topic: string) => void;
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  roomCode,
  currentExercise,
  roadmap,
  mySlot,
  myProgress,
  setMyProgress,
  sourceTitle,
  onOpenUpload,
  onStartCustomTopic,
}) => {
  const isHost = mySlot === "A";
  const [onboardContent, setOnboardContent] = useState<string>("");
  const [isLoadingOnboard, setIsLoadingOnboard] = useState<boolean>(false);
  const [showOnboardLesson, setShowOnboardLesson] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Rate Limit Countdown State
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  // Chat & Evaluation states
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [quickTopicInput, setQuickTopicInput] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentExerciseObj = roadmap.find((ex) => ex.id === currentExercise);
  const hasActiveSource = Boolean(sourceTitle && sourceTitle.trim().length > 0 && roadmap.length > 0);

  // Rate limit countdown timer loop
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;

    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, onboardContent]);

  // Load Phase 1 Onboarding when exercise or source changes
  useEffect(() => {
    if (!hasActiveSource) return;

    let isMounted = true;

    const loadPhase1 = async () => {
      // 1. Try fetching from Supabase database / cache
      const cached = await syncEngine.fetchOnboardingCache(sourceTitle, currentExercise);
      if (cached && isMounted) {
        setOnboardContent(cached);
        return;
      }

      const cloudMsgs = await syncEngine.fetchTutorMessages(mySlot, currentExercise);
      const existing = cloudMsgs.find((m) => m.phase === 1);

      if (existing && isMounted) {
        setOnboardContent(existing.content);
        return;
      }

      // 2. Generate via real Gemini API
      if (isMounted) {
        setIsLoadingOnboard(true);
        setApiError(null);
      }

      try {
        const res = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "onboard",
            exerciseIndex: currentExercise,
            exerciseTitle: currentExerciseObj?.title || "",
            phase: 1,
            sourceTitle,
            roomCode,
          }),
        });

        const data = await res.json();
        if (!isMounted) return;

        if (res.status === 429 || data.error === "RATE_LIMIT") {
          setRateLimitCountdown(data.retryAfterSeconds || 15);
          setApiError("تم الوصول للحد المؤقت للـ API — انتظر 15 ثانية ثم أعد المحاولة.");
        } else if (data.error) {
          setApiError(data.message || "يرجى التحقق من مفتاح Gemini API.");
        } else if (data.content) {
          setOnboardContent(data.content);
          // Persist to Supabase
          syncEngine.addTutorMessage({
            room_id: roomCode,
            student_slot: mySlot,
            exercise_index: currentExercise,
            phase: 1,
            role: "assistant",
            content: data.content,
          });
          syncEngine.saveOnboardingCache(sourceTitle, currentExercise, data.content);
        }
      } catch (err) {
        console.error("Failed to load Phase 1 onboarding:", err);
        if (isMounted) {
          setApiError("تعذر تحميل التأسيس من الذكاء الاصطناعي.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingOnboard(false);
        }
      }
    };

    loadPhase1();

    return () => {
      isMounted = false;
    };
  }, [currentExercise, hasActiveSource, mySlot, roomCode, sourceTitle, currentExerciseObj?.title]);

  // Load Conversation History for current exercise from Supabase
  useEffect(() => {
    let isMounted = true;

    const loadExerciseChat = async () => {
      const cloudMsgs = await syncEngine.fetchTutorMessages(mySlot, currentExercise);
      if (isMounted) {
        setMessages(cloudMsgs.filter((m) => m.phase === 2));
      }
    };

    loadExerciseChat();

    return () => {
      isMounted = false;
    };
  }, [currentExercise, mySlot]);

  // Handle notebook photo upload with client-side canvas compression
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setSelectedImage(compressedBase64);
        soundService.playSignalPing();
      } catch (err) {
        console.error("Image compression error:", err);
        // Fallback to direct read
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImage(reader.result as string);
          soundService.playSignalPing();
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Submit Answer or Question to Gemini AI Tutor
  const handleSubmit = async (overrideText?: string) => {
    const textToSend = (overrideText ?? inputText).trim();
    if (!textToSend && !selectedImage) return;

    const userPrompt = textToSend || "[Handwritten Solution Attached]";
    setIsSubmitting(true);
    setApiError(null);

    const userMsg: TutorMessage = {
      id: `user-${Date.now()}`,
      room_id: roomCode,
      student_slot: mySlot,
      exercise_index: currentExercise,
      phase: 2,
      role: "user",
      content: userPrompt,
      image_url: selectedImage || undefined,
      created_at: new Date().toISOString(),
    };

    // Save to local UI and Supabase Cloud
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setSelectedImage(null);

    syncEngine.addTutorMessage({
      room_id: roomCode,
      student_slot: mySlot,
      exercise_index: currentExercise,
      phase: 2,
      role: "user",
      content: userPrompt,
      image_url: selectedImage || undefined,
    });

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate",
          roomCode,
          exerciseIndex: currentExercise,
          exerciseTitle: currentExerciseObj?.title || "",
          stage: myProgress.current_stage,
          phase: 2,
          userPrompt,
          imageBase64: selectedImage,
          currentStrikes: myProgress.strikes,
          sourceTitle,
          history: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (res.status === 429 || data.error === "RATE_LIMIT") {
        setRateLimitCountdown(data.retryAfterSeconds || 15);
        setApiError("تم الوصول للحد المؤقت للـ API — انتظر 15 ثانية ثم أعد المحاولة.");
        soundService.playStrikeAlert();
        return;
      }

      if (data.error) {
        setApiError(data.message || "حدث خطأ أثناء الاتصال بـ Gemini API.");
        soundService.playStrikeAlert();
        return;
      }

      const assistantMsg: TutorMessage = {
        id: `tutor-${Date.now()}`,
        room_id: roomCode,
        student_slot: mySlot,
        exercise_index: currentExercise,
        phase: 2,
        role: "assistant",
        content: data.content || "تم التقييم بنجاح.",
        score: data.metadata?.score,
        metadata: data.metadata,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Save to Supabase Cloud
      syncEngine.addTutorMessage({
        room_id: roomCode,
        student_slot: mySlot,
        exercise_index: currentExercise,
        phase: 2,
        role: "assistant",
        content: data.content,
        score: data.metadata?.score,
        metadata: data.metadata,
      });

      // Strict Intent Guard: ONLY grade and update progress if intent is 'answer_submission'
      const isAnswerSubmission = data.metadata?.intent === "answer_submission";

      if (isAnswerSubmission) {
        const passed = Boolean(data.metadata?.passed);
        const score = typeof data.metadata?.score === "number" ? data.metadata.score : 0;
        const newStrikes = data.metadata?.strike_count ?? (passed ? 0 : myProgress.strikes + 1);

        if (passed && score >= 9) {
          soundService.playMasteryFanfare();
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ["#899C96", "#242D36", "#BBC5C5"],
          });

          let nextStage = myProgress.current_stage + 1;
          let nextExercise = myProgress.current_exercise;

          if (nextStage > 3) {
            nextStage = 1;
            nextExercise += 1;
          }

          const updatedProgress: StudentProgress = {
            ...myProgress,
            current_exercise: nextExercise,
            current_stage: nextStage,
            strikes: 0,
            last_score: score,
            passed_stages: [...(myProgress.passed_stages || []), myProgress.current_stage],
          };
          setMyProgress(updatedProgress);
          syncEngine.saveProgress(updatedProgress);
          syncEngine.updateMyPresence(nextExercise, nextStage);
        } else if (score < 9) {
          soundService.playStrikeAlert();

          const weaknessStr = data.metadata?.weaknesses?.[0] || "تحدي بحاجة لمزيد من الإتقان الرياضي/المفاهيمي";
          syncEngine.addMistake({
            room_id: roomCode,
            student_slot: mySlot,
            exercise_index: currentExercise,
            stage: myProgress.current_stage,
            weakness_summary: weaknessStr,
            resolved: false,
          });

          const newMistake = {
            exercise: currentExercise,
            stage: myProgress.current_stage,
            weakness: weaknessStr,
            timestamp: new Date().toLocaleTimeString(),
          };

          const updatedProgress: StudentProgress = {
            ...myProgress,
            strikes: newStrikes >= 3 ? 0 : newStrikes,
            last_score: score,
            mistakes: [...myProgress.mistakes, newMistake],
          };
          setMyProgress(updatedProgress);
          syncEngine.saveProgress(updatedProgress);
        }
      }
    } catch (err) {
      console.error("Evaluation submission error:", err);
      setApiError("تعذر الاتصال بالخادم. يرجى التأكد من اتصالك بالإنترنت.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickTopicInput.trim() && onStartCustomTopic) {
      onStartCustomTopic(quickTopicInput.trim());
      setQuickTopicInput("");
    }
  };

  // 1. EMPTY STATE
  if (!hasActiveSource) {
    return (
      <div className="bg-spectral-white text-midnight-ink rounded-3xl p-6 sm:p-10 shadow-sm border border-stormy-slate/20 flex flex-col items-center justify-center flex-1 min-w-0 min-h-[640px] text-center font-arabic">
        {isHost ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-midnight-ink flex items-center justify-center mb-4 text-spectral-white shadow-md">
              <BookOpen className="w-8 h-8 text-eerie-sage" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-midnight-ink mb-2 tracking-tight">
              مرحباً بك في غرفتك الدراسية الخاصة
            </h2>
            <p className="text-xs sm:text-sm text-stormy-slate max-w-md mb-6 leading-relaxed">
              بصفتك مسؤول الغرفة، يمكنك الآن رفع ملف الكورس (PDF أو صورة تمرين) أو كتابة موضوع الدرس لبدء جلسة التعلم فوراً وتوليد المسار لك ولزملائك:
            </p>

            {/* Option A: Upload Button */}
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-midnight-ink text-spectral-white text-sm font-bold hover:bg-midnight-ink/90 active:scale-95 transition-all shadow-md mb-5"
            >
              <Upload className="w-5 h-5 text-eerie-sage" />
              <span>+ ارفع ملف الكورس (PDF / صورة)</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 w-full max-w-xs mb-5">
              <div className="h-px bg-stormy-slate/20 flex-1"></div>
              <span className="text-[11px] font-bold text-stormy-slate uppercase tracking-wider">أو البدء السريع</span>
              <div className="h-px bg-stormy-slate/20 flex-1"></div>
            </div>

            {/* Option B: Quick Topic Input */}
            <form onSubmit={handleStartTopic} className="w-full max-w-md flex items-center gap-2">
              <input
                type="text"
                value={quickTopicInput}
                onChange={(e) => setQuickTopicInput(e.target.value)}
                placeholder="اكتب عنوان الدرس أو المسألة هنا..."
                className="flex-1 bg-white border border-stormy-slate/30 rounded-2xl px-4 py-3 text-xs sm:text-sm text-midnight-ink outline-hidden focus:border-midnight-ink shadow-2xs"
                dir="rtl"
              />
              <button
                type="submit"
                disabled={!quickTopicInput.trim()}
                className="px-5 py-3 rounded-2xl bg-midnight-ink text-spectral-white font-bold text-xs sm:text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-xs"
              >
                بدء
              </button>
            </form>
          </>
        ) : (
          /* Guest Partner waiting view */
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-silver-fog/40 flex items-center justify-center mb-4 text-stormy-slate animate-pulse">
              <Clock className="w-8 h-8 text-midnight-ink" />
            </div>
            <h2 className="text-xl font-black text-midnight-ink mb-2">
              بانتظار قيام أمير برفع ملف الكورس
            </h2>
            <p className="text-xs sm:text-sm text-stormy-slate max-w-md leading-relaxed">
              أنت متصل الآن كطالب في الغرفة. بمجرد قيام أمير برفع ملف الكورس أو تحديد الموضوع، ستظهر لك التمارين والشرح التفاعلي هنا فوراً.
            </p>
          </div>
        )}
      </div>
    );
  }

  // 2. ACTIVE LEARNING WORKSPACE
  return (
    <div className="bg-spectral-white text-midnight-ink rounded-3xl p-5 sm:p-6 shadow-sm border border-stormy-slate/20 flex flex-col flex-1 min-w-0 h-[740px] font-arabic">
      {/* Top Workspace Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-stormy-slate/15 shrink-0">
        <div className="flex items-center gap-2.5 truncate max-w-md">
          <span className="w-3 h-3 rounded-full bg-eerie-sage shrink-0 animate-pulse"></span>
          <div className="flex flex-col truncate">
            <span className="text-xs sm:text-sm font-black text-midnight-ink truncate">
              {currentExerciseObj?.title || `Exercise ${currentExercise}`}
            </span>
            <span className="text-[11px] text-stormy-slate font-medium truncate">
              المصدر المعتمد: {sourceTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-full bg-midnight-ink text-spectral-white text-xs font-bold font-mono shadow-2xs">
            Stage {myProgress.current_stage}/3
          </span>

          <button
            onClick={() => setShowOnboardLesson((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stormy-slate/20 text-xs font-semibold text-stormy-slate hover:text-midnight-ink transition-all shadow-2xs"
            title="إظهار / إخفاء ملخص التأسيس الـ 6 نقاط"
          >
            <BookOpen className="w-3.5 h-3.5 text-eerie-sage" />
            <span className="hidden sm:inline">شرح الدرس</span>
            {showOnboardLesson ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* HTTP 429 Rate Limit Countdown Banner */}
      {rateLimitCountdown !== null && (
        <div className="mt-2.5 p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 font-bold shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-amber-700 animate-spin" />
            <span>
              تم الوصول للحد المؤقت للـ API — انتظر{" "}
              <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 font-black">
                {rateLimitCountdown}
              </span>{" "}
              ثانية ثم أعد المحاولة.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={rateLimitCountdown > 0}
            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-200 text-amber-900 hover:bg-amber-300 disabled:opacity-50 text-xs font-bold transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>إعادة المحاولة الآن</span>
          </button>
        </div>
      )}

      {/* General API Error Notification (if not 429) */}
      {apiError && rateLimitCountdown === null && (
        <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 font-medium shrink-0">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Scrollable Conversation Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 my-3 pr-2 scrollbar-thin">
        {/* Phase 1 Deep Onboarding Lesson Card */}
        {showOnboardLesson && (
          <div className="bg-white/90 rounded-2xl p-5 border border-stormy-slate/20 shadow-2xs">
            {isLoadingOnboard ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-stormy-slate">
                <RotateCw className="w-6 h-6 animate-spin text-eerie-sage" />
                <p className="text-xs font-arabic">
                  جاري تحضير شرح التأسيس المعمق عبر الذكاء الاصطناعي...
                </p>
              </div>
            ) : (
              <TutorContentFormatter content={onboardContent || "جاري توليد شرح الدرس..."} />
            )}
          </div>
        )}

        {/* Phase 2 Interactive Messages */}
        {messages.length === 0 && !isLoadingOnboard && (
          <div className="bg-silver-fog/20 rounded-2xl p-4 border border-stormy-slate/15 text-center">
            <Sparkles className="w-6 h-6 text-eerie-sage mx-auto mb-1.5" />
            <p className="text-xs font-bold text-midnight-ink">
              حلبة الإتقان نشطة (Stage {myProgress.current_stage}/3)
            </p>
            <p className="text-[11px] text-stormy-slate mt-0.5">
              اكتب حلك أو استفسارك في صندوق الإدخال بالأسفل للتصحيح الفعلي بذكاء Gemini.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xs transition-all ${
                msg.role === "user"
                  ? "bg-midnight-ink text-spectral-white"
                  : "bg-white text-midnight-ink border border-stormy-slate/20 font-arabic"
              }`}
              dir={msg.role === "assistant" ? "rtl" : "ltr"}
            >
              {msg.image_url && (
                <div className="mb-2.5 rounded-xl overflow-hidden border border-stormy-slate/20 max-w-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={msg.image_url}
                    alt="Handwritten solution"
                    className="w-full object-cover max-h-56"
                  />
                </div>
              )}

              {msg.role === "assistant" ? (
                <TutorContentFormatter content={msg.content} />
              ) : (
                <div className="whitespace-pre-line">{msg.content}</div>
              )}

              {msg.score !== undefined && msg.score !== null && msg.metadata?.intent === "answer_submission" && (
                <div className="mt-3 pt-2.5 border-t border-stormy-slate/20 flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-stormy-slate">الدرجة:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      msg.score >= 9
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-stormy-slate/20 text-midnight-ink"
                    }`}
                  >
                    {msg.score} / 10 {msg.score >= 9 ? "✓ تم الإتقان" : "↺ في مرحلة التحسين"}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Compressed Image Preview */}
      {selectedImage && (
        <div className="mb-2 p-2 bg-silver-fog/40 rounded-xl flex items-center justify-between max-w-xs border border-stormy-slate/20 shrink-0">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-midnight-ink" />
            <span className="text-xs font-semibold text-midnight-ink truncate">
              تم تجهيز وضغط صورة الدفتر
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="text-xs text-stormy-slate hover:text-midnight-ink font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Action Suggestion Chips */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 shrink-0">
        <button
          type="button"
          onClick={() => handleSubmit("أنا جاهز للسؤال التالي")}
          disabled={isSubmitting}
          className="px-2.5 py-1 rounded-full bg-white border border-stormy-slate/20 text-[11px] font-semibold text-stormy-slate hover:text-midnight-ink hover:border-midnight-ink transition-all shrink-0 shadow-2xs"
        >
          جاهز للحل ✍️
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("هل يمكنك توضيح هذه النقطة بمثال إضافي بسيط؟")}
          disabled={isSubmitting}
          className="px-2.5 py-1 rounded-full bg-white border border-stormy-slate/20 text-[11px] font-semibold text-stormy-slate hover:text-midnight-ink hover:border-midnight-ink transition-all shrink-0 shadow-2xs"
        >
          اشرح لي بمثال آخر 💡
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("ما هي القواعد الأساسية التي يجب التركيز عليها هنا؟")}
          disabled={isSubmitting}
          className="px-2.5 py-1 rounded-full bg-white border border-stormy-slate/20 text-[11px] font-semibold text-stormy-slate hover:text-midnight-ink hover:border-midnight-ink transition-all shrink-0 shadow-2xs"
        >
          أهم القواعد 🔍
        </button>
      </div>

      {/* ALWAYS VISIBLE & PERSISTENT AI INPUT BAR */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex items-end gap-2 bg-white border-2 border-stormy-slate/25 rounded-2xl p-2.5 focus-within:border-midnight-ink shadow-sm transition-all shrink-0"
      >
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="اكتب إجابتك، الكود، أو اسأل الذكاء الاصطناعي أي استفسار هنا..."
          className="flex-1 bg-transparent border-0 resize-none outline-hidden text-xs sm:text-sm text-midnight-ink p-1 min-h-[46px] max-h-28"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="إرفاق صورة الحل المكتوب يدوياً من الدفتر (تضغط تلقائياً)"
          className="p-2.5 rounded-xl text-stormy-slate hover:text-midnight-ink hover:bg-silver-fog/40 transition-all"
        >
          <Camera className="w-5 h-5" />
        </button>

        <button
          type="submit"
          disabled={isSubmitting || (!inputText.trim() && !selectedImage)}
          className={`p-3 rounded-xl transition-all ${
            isSubmitting || (!inputText.trim() && !selectedImage)
              ? "bg-silver-fog/40 text-stormy-slate/50 cursor-not-allowed"
              : "bg-midnight-ink text-spectral-white hover:bg-midnight-ink/90 active:scale-95 shadow-md"
          }`}
        >
          {isSubmitting ? (
            <RotateCw className="w-5 h-5 animate-spin text-eerie-sage" />
          ) : (
            <Send className="w-5 h-5 text-eerie-sage" />
          )}
        </button>
      </form>
    </div>
  );
};
