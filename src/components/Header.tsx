"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  Sparkles,
  FolderOpen,
  Crown,
  Share2,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Clock,
  LayoutGrid,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { soundService } from "@/lib/audio";
import { StudentSlot, LayoutVisibility } from "@/types";

interface HeaderProps {
  roomCode: string;
  courseTitle: string;
  mySlot: StudentSlot;
  studentName: string;
  onOpenUpload: () => void;
  layout: LayoutVisibility;
  onUpdateLayout: (key: keyof LayoutVisibility, value: boolean) => void;
  onToggleZenMode: () => void;
  miniTimerText?: string;
  isTimerRunning?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  courseTitle,
  mySlot,
  studentName,
  onOpenUpload,
  layout,
  onUpdateLayout,
  onToggleZenMode,
  miniTimerText = "50:00",
  isTimerRunning = false,
}) => {
  const isHost = mySlot === "A";
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMuted, setIsMuted] = useState(soundService.getIsMuted());
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);

  // Close layout popover on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(event.target as Node)) {
        setIsLayoutMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    soundService.playSignalPing();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/?invite=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    soundService.playSignalPing();
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleToggleSound = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      soundService.playSignalPing();
    }
  };

  const shouldShowMiniTimer = layout.zenMode || !layout.showPomodoro;

  return (
    <header className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 px-1 select-none">
      {/* Right side in RTL: Title & Active Course */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-black text-midnight-ink tracking-tight font-arabic">
            غرفة دراسة التميز
          </h1>

          {/* User Role Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold font-arabic shadow-2xs ${
              isHost
                ? "bg-midnight-ink text-spectral-white"
                : "bg-silver-fog/40 text-midnight-ink border border-stormy-slate/20"
            }`}
          >
            {isHost ? (
              <Crown className="w-3.5 h-3.5 text-eerie-sage" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-stormy-slate" />
            )}
            <span>{isHost ? `المسؤول: ${studentName}` : `الزميل: ${studentName}`}</span>
          </span>

          {/* Mini Timer Pill (Visible when Pomodoro is hidden or in Zen mode) */}
          {shouldShowMiniTimer && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold shadow-2xs transition-all ${
                isTimerRunning
                  ? "bg-midnight-ink text-spectral-white animate-pulse border border-eerie-sage/40"
                  : "bg-white text-midnight-ink border border-stormy-slate/30"
              }`}
              title="مؤقت التركيز المصغر (بومودورو متزامن)"
            >
              <Clock className="w-3.5 h-3.5 text-eerie-sage" />
              <span>{miniTimerText}</span>
            </div>
          )}
        </div>

        <p className="text-xs sm:text-sm text-stormy-slate font-medium truncate max-w-md mt-1 font-arabic">
          {courseTitle ? (
            <>
              المصدر الدراسي: <span className="font-bold text-midnight-ink">{courseTitle}</span>
            </>
          ) : (
            <span className="text-stormy-slate italic">
              {isHost ? "لم تقم برفع أي ملف دراسي بعد" : "بانتظار قيام أمير برفع ملف الكورس"}
            </span>
          )}
        </p>
      </div>

      {/* Left side in RTL: Controls & Actions */}
      <div className="flex items-center flex-wrap gap-2 self-stretch sm:self-auto">
        {/* Gemini Engine Active Pill */}
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
          <span>Gemini 2.5 Flash</span>
        </span>

        {/* 1-Click Zen Mode Button */}
        <button
          type="button"
          onClick={onToggleZenMode}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all shadow-xs active:scale-95 ${
            layout.zenMode
              ? "bg-eerie-sage text-midnight-ink border border-midnight-ink font-black shadow-md"
              : "bg-white text-midnight-ink border border-stormy-slate/20 hover:border-midnight-ink"
          }`}
          title={layout.zenMode ? "الخروج من وضع التركيز (عرض القوائم)" : "تفعيل وضع التركيز (توسيع مساحة العمل لـ 100%)"}
        >
          {layout.zenMode ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              <span>إنهاء التركيز</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-midnight-ink" />
              <span>وضع التركيز</span>
            </>
          )}
        </button>

        {/* Layout Customizer Popover Menu */}
        <div className="relative" ref={layoutMenuRef}>
          <button
            type="button"
            onClick={() => setIsLayoutMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all shadow-xs active:scale-95 border ${
              isLayoutMenuOpen
                ? "bg-midnight-ink text-spectral-white border-midnight-ink"
                : "bg-white text-midnight-ink border-stormy-slate/20 hover:border-midnight-ink"
            }`}
            title="تخصيص الواجهة وإخفاء/إظهار البطاقات"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>تخصيص الواجهة</span>
          </button>

          {isLayoutMenuOpen && (
            <div
              className="absolute left-0 sm:right-auto sm:left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stormy-slate/25 p-3.5 z-50 flex flex-col gap-2 font-arabic"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-stormy-slate/15">
                <span className="text-xs font-extrabold text-midnight-ink flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-stormy-slate" />
                  عناصر الواجهة
                </span>
                <span className="text-[10px] text-stormy-slate">تفضيلاتك الخاصة</span>
              </div>

              {/* Toggle Sidebar */}
              <label className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-stormy-slate/5 cursor-pointer">
                <span className="text-xs font-semibold text-midnight-ink">القائمة الجانبية</span>
                <input
                  type="checkbox"
                  checked={layout.showSidebar}
                  onChange={(e) => onUpdateLayout("showSidebar", e.target.checked)}
                  className="w-4 h-4 rounded text-midnight-ink accent-midnight-ink cursor-pointer"
                />
              </label>

              {/* Toggle Pomodoro */}
              <label className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-stormy-slate/5 cursor-pointer">
                <span className="text-xs font-semibold text-midnight-ink">مؤقت بومودورو</span>
                <input
                  type="checkbox"
                  checked={layout.showPomodoro}
                  onChange={(e) => onUpdateLayout("showPomodoro", e.target.checked)}
                  className="w-4 h-4 rounded text-midnight-ink accent-midnight-ink cursor-pointer"
                />
              </label>

              {/* Toggle Top Cards (Roadmap & Mastery) */}
              <label className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-stormy-slate/5 cursor-pointer">
                <span className="text-xs font-semibold text-midnight-ink">بطاقات المسار والإتقان</span>
                <input
                  type="checkbox"
                  checked={layout.showStatsRow}
                  onChange={(e) => onUpdateLayout("showStatsRow", e.target.checked)}
                  className="w-4 h-4 rounded text-midnight-ink accent-midnight-ink cursor-pointer"
                />
              </label>

              {/* Toggle Break Lounge */}
              <label className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-stormy-slate/5 cursor-pointer">
                <span className="text-xs font-semibold text-midnight-ink">غرفة الاستراحة</span>
                <input
                  type="checkbox"
                  checked={layout.showBreakLounge}
                  onChange={(e) => onUpdateLayout("showBreakLounge", e.target.checked)}
                  className="w-4 h-4 rounded text-midnight-ink accent-midnight-ink cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>

        {/* Host Exclusive File Upload Button */}
        {isHost && (
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-midnight-ink text-spectral-white hover:bg-midnight-ink/90 active:scale-95 transition-all text-xs font-bold shadow-sm"
          >
            <FolderOpen className="w-3.5 h-3.5 text-eerie-sage" />
            <span>+ إدارة الملفات 👑</span>
          </button>
        )}

        {/* Host Invite Link Copy Button */}
        {isHost && (
          <button
            onClick={handleCopyInviteLink}
            title="نسخ رابط دعوة الزملاء"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white text-midnight-ink hover:border-midnight-ink border border-stormy-slate/20 transition-all text-xs font-bold shadow-sm active:scale-95"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-eerie-sage" />
                <span className="text-eerie-sage">تم النسخ!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-stormy-slate" />
                <span className="hidden sm:inline">رابط الدعوة</span>
              </>
            )}
          </button>
        )}

        {/* Room Code Pill */}
        <button
          onClick={handleCopyCode}
          title="نسخ رمز الغرفة"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-spectral-white text-midnight-ink hover:bg-white border border-stormy-slate/20 transition-all text-xs font-semibold shadow-sm active:scale-95"
        >
          {copiedCode ? (
            <>
              <Check className="w-3.5 h-3.5 text-eerie-sage" />
              <span className="text-eerie-sage font-bold">تم!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-stormy-slate" />
              <span>{roomCode}</span>
            </>
          )}
        </button>

        {/* Sound Toggle Button */}
        <button
          onClick={handleToggleSound}
          title={isMuted ? "تفعيل التنبيهات الصوتية" : "كتم الصوت"}
          className={`p-2 rounded-full transition-all border shadow-sm active:scale-95 ${
            isMuted
              ? "bg-spectral-white text-stormy-slate border-stormy-slate/20 hover:text-midnight-ink"
              : "bg-midnight-ink text-eerie-sage border-midnight-ink"
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
