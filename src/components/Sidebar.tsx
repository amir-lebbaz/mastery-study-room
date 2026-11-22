"use client";

import React from "react";
import {
  BookOpen,
  AlertCircle,
  Settings,
  Sparkles,
  GraduationCap,
  Crown,
  User,
} from "lucide-react";
import { StudentProgress, StudentSlot } from "@/types";

interface SidebarProps {
  roomCode: string;
  activeTab: "study" | "sources" | "mistakes" | "settings";
  setActiveTab: (tab: "study" | "sources" | "mistakes" | "settings") => void;
  mySlot: StudentSlot;
  myProgress: StudentProgress;
  onOpenUpload: () => void;
  onOpenMistakes: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  roomCode,
  activeTab,
  setActiveTab,
  mySlot,
  myProgress,
  onOpenUpload,
  onOpenMistakes,
}) => {
  const isHost = mySlot === "A";

  return (
    <aside className="w-full lg:w-72 shrink-0 flex flex-col justify-between bg-spectral-white rounded-3xl p-5 shadow-sm border border-stormy-slate/20 transition-all font-arabic lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
      {/* Top Branding & Navigation */}
      <div className="flex flex-col gap-5">
        {/* Logo & Role Badge */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="w-10 h-10 rounded-2xl bg-midnight-ink flex items-center justify-center text-spectral-white shadow-sm shrink-0">
              <GraduationCap className="w-5 h-5 text-eerie-sage" />
            </div>
            <div>
              <div className="text-base font-black text-midnight-ink leading-tight tracking-tight">
                غرفة دراسة التميز
              </div>
              <div className="text-[11px] text-stormy-slate font-medium">جلسة دراسية تفاعلية خاصة</div>
            </div>
          </div>

          {/* Current Role Banner */}
          <div
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 border shadow-2xs ${
              isHost
                ? "bg-midnight-ink text-spectral-white border-midnight-ink"
                : "bg-silver-fog/40 text-midnight-ink border-stormy-slate/20"
            }`}
          >
            {isHost ? (
              <>
                <Crown className="w-4 h-4 text-eerie-sage" />
                <span>أنت مسؤول الغرفة (التحكم الكامل)</span>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-stormy-slate" />
                <span>طالب مدعو للمشاركة</span>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-col gap-1.5">
          <button
            onClick={() => setActiveTab("study")}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "study"
                ? "bg-midnight-ink text-spectral-white shadow-sm"
                : "text-stormy-slate hover:bg-stormy-slate/10 hover:text-midnight-ink"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>غرفة الدراسة</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("sources");
              onOpenUpload();
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "sources"
                ? "bg-midnight-ink text-spectral-white shadow-sm"
                : "text-stormy-slate hover:bg-stormy-slate/10 hover:text-midnight-ink"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{isHost ? "إدارة ملفات الكورس 👑" : "ملفات الكورس المعتمدة"}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("mistakes");
              onOpenMistakes();
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "mistakes"
                ? "bg-midnight-ink text-spectral-white shadow-sm"
                : "text-stormy-slate hover:bg-stormy-slate/10 hover:text-midnight-ink"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>سجل معالجة الأخطاء</span>
            {myProgress.mistakes && myProgress.mistakes.length > 0 && (
              <span className="mr-auto bg-eerie-sage/30 text-midnight-ink text-xs px-2 py-0.5 rounded-full font-bold">
                {myProgress.mistakes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "settings"
                ? "bg-midnight-ink text-spectral-white shadow-sm"
                : "text-stormy-slate hover:bg-stormy-slate/10 hover:text-midnight-ink"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>إعدادات الجلسة</span>
          </button>
        </nav>
      </div>

      {/* Bottom Footer Note */}
      <div className="pt-4 border-t border-stormy-slate/15 flex flex-col gap-1 text-[11px] text-stormy-slate text-center">
        <span className="font-semibold text-midnight-ink">Mastery Study Room v2.0</span>
        <span>نظام الإتقان التشاركي بالذكاء الاصطناعي</span>
      </div>
    </aside>
  );
};
