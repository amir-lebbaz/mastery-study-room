"use client";

import React from "react";
import { CheckCircle2, Lock, ArrowLeft, BookOpen, Plus } from "lucide-react";
import { RoadmapExercise, StudentProgress } from "@/types";

interface RoadmapCardProps {
  roadmap: RoadmapExercise[];
  currentExercise: number;
  setCurrentExercise: (id: number) => void;
  myProgress: StudentProgress;
  isHost: boolean;
  onOpenUpload?: () => void;
}

export const RoadmapCard: React.FC<RoadmapCardProps> = ({
  roadmap,
  currentExercise,
  setCurrentExercise,
  myProgress,
  isHost,
  onOpenUpload,
}) => {
  return (
    <div className="bg-spectral-white text-midnight-ink rounded-3xl p-5 shadow-sm border border-stormy-slate/20 flex flex-col justify-between h-full min-h-[195px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-midnight-ink" />
          <h2 className="text-sm sm:text-base font-extrabold text-midnight-ink font-arabic">
            مسار الإتقان التسلسلي
          </h2>
        </div>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-silver-fog/50 text-midnight-ink font-arabic">
          فتح متتابع
        </span>
      </div>

      {/* Checklist items or Empty State */}
      {roadmap.length === 0 ? (
        <div className="my-auto py-3 flex flex-col items-center justify-center text-center text-stormy-slate font-arabic">
          <p className="text-xs font-bold text-midnight-ink">لا يوجد مسار تمارين نشط</p>
          <p className="text-[11px] mt-1 max-w-[240px] text-stormy-slate">
            {isHost
              ? "ارفع ملف الكورس ليستخرج الذكاء الاصطناعي التمارين والمفاهيم تسلسلياً."
              : "بانتظار قيام أمير برفع ملف الكورس لبدء الجلسة الدراسية."}
          </p>
          {isHost && onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-midnight-ink text-spectral-white text-xs font-bold hover:bg-midnight-ink/90 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-eerie-sage" />
              <span>+ رفع الملف الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 my-1 overflow-y-auto max-h-[120px] pr-0.5">
          {roadmap.map((item, idx) => {
            const isCurrent = currentExercise === item.id;
            const isUnlocked = item.id <= myProgress.current_exercise;
            const isDone = item.id < myProgress.current_exercise;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isUnlocked) {
                    setCurrentExercise(item.id);
                  }
                }}
                className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between ${
                  isCurrent
                    ? "bg-midnight-ink text-spectral-white border-midnight-ink shadow-sm"
                    : isUnlocked
                    ? "bg-white/80 border-stormy-slate/15 hover:border-stormy-slate/30 cursor-pointer"
                    : "bg-silver-fog/20 border-stormy-slate/10 opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex items-center justify-center shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-eerie-sage" />
                    ) : isUnlocked ? (
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                          isCurrent
                            ? "border-eerie-sage text-eerie-sage"
                            : "border-stormy-slate text-stormy-slate"
                        }`}
                      >
                        {idx + 1}
                      </div>
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-stormy-slate/70" />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-xs font-bold truncate max-w-[170px] ${
                        isCurrent ? "text-spectral-white" : "text-midnight-ink"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span
                      className={`text-[10px] truncate max-w-[170px] ${
                        isCurrent ? "text-silver-fog" : "text-stormy-slate"
                      }`}
                    >
                      {item.topic}
                    </span>
                  </div>
                </div>

                {isCurrent && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-eerie-sage text-midnight-ink flex items-center gap-0.5 shrink-0">
                    <span>قيد الدراسة</span>
                    <ArrowLeft className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Indicator */}
      <div className="pt-2 border-t border-stormy-slate/15 flex items-center justify-between text-xs text-stormy-slate font-arabic">
        <span>
          المكتمل: {roadmap.length === 0 ? 0 : Math.max(0, myProgress.current_exercise - 1)} من {roadmap.length}
        </span>
        <span className="font-bold text-midnight-ink">
          {roadmap.length === 0
            ? "0%"
            : `${Math.round(((myProgress.current_exercise - 1) / Math.max(1, roadmap.length)) * 100)}% تم الإنجاز`}
        </span>
      </div>
    </div>
  );
};
