"use client";

import React, { useState } from "react";
import { GraduationCap, Crown, BookOpen, ArrowRight, ShieldCheck, Sparkles, Clock } from "lucide-react";

interface GuestLoginModalProps {
  isOpen: boolean;
  roomCode: string;
  activeCourseTitle: string;
  onJoin: (guestName: string) => void;
}

export const GuestLoginModal: React.FC<GuestLoginModalProps> = ({
  isOpen,
  roomCode,
  activeCourseTitle,
  onJoin,
}) => {
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) {
      setError("يرجى كتابة اسمك للمتابعة.");
      return;
    }
    if (cleanName.length < 2) {
      setError("الاسم يجب أن يحتوي على حرفين على الأقل.");
      return;
    }
    setError("");
    onJoin(cleanName);
  };

  return (
    <div className="fixed inset-0 bg-midnight-ink/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
      <div className="bg-spectral-white text-midnight-ink rounded-3xl p-6 sm:p-9 max-w-md w-full shadow-2xl border border-stormy-slate/30 text-center relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-midnight-ink via-eerie-sage to-midnight-ink" />

        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-midnight-ink text-spectral-white flex items-center justify-center mx-auto mb-4 shadow-md">
          <GraduationCap className="w-8 h-8 text-eerie-sage" />
        </div>

        {/* Host Banner */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-midnight-ink text-spectral-white text-xs font-bold mb-3 shadow-2xs">
          <Crown className="w-3.5 h-3.5 text-eerie-sage" />
          <span>دعوة خاصة من: أمير (صاحب الغرفة)</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-midnight-ink mb-1.5 tracking-tight font-arabic">
          انضمام لجلسة المذاكرة التفاعلية
        </h2>
        <p className="text-xs text-stormy-slate mb-5 leading-relaxed font-arabic">
          أنت مدعو للمذاكرة المشتركة خطوة بخطوة في الغرفة رقم{" "}
          <span className="font-mono font-bold text-midnight-ink px-1.5 py-0.5 rounded bg-silver-fog/40">
            #{roomCode}
          </span>
          . اكتب اسمك لتسجيل الدخول ويراك أمير متصلاً فوراً:
        </p>

        {/* Active Course Preview if available */}
        {activeCourseTitle ? (
          <div className="p-3.5 bg-white rounded-2xl border border-stormy-slate/20 mb-5 text-right flex items-center gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-eerie-sage/20 text-midnight-ink flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-midnight-ink" />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-stormy-slate block font-bold">الموضوع المعتمد للدراسة:</span>
              <span className="text-xs font-black text-midnight-ink truncate block">
                {activeCourseTitle}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white/60 rounded-2xl border border-stormy-slate/15 mb-5 text-center text-xs text-stormy-slate font-medium">
            <span>⏱️ بانتظار اعتماد موضوع الدرس أو ملف الكورس من أمير</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="text-right">
            <label className="block text-xs font-bold text-midnight-ink mb-1.5 font-arabic">
              اكتب اسمك الكامل أو لقبك (Username) *
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (error) setError("");
              }}
              placeholder="مثال: أحمد، ياسين، مريم..."
              className="w-full bg-white border border-stormy-slate/30 rounded-2xl px-4 py-3 text-sm font-bold text-midnight-ink outline-hidden focus:border-midnight-ink shadow-2xs text-right font-arabic"
              required
              autoFocus
              maxLength={30}
            />
            {error && (
              <span className="text-[11px] text-red-600 font-bold block mt-1 pr-1 font-arabic">
                {error}
              </span>
            )}
          </div>

          {/* Features Highlights */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-stormy-slate my-1">
            <div className="p-2 rounded-xl bg-silver-fog/20 flex items-center gap-1.5 text-right">
              <Clock className="w-3.5 h-3.5 text-midnight-ink shrink-0" />
              <span>مؤقت 50/10 متزامن</span>
            </div>
            <div className="p-2 rounded-xl bg-silver-fog/20 flex items-center gap-1.5 text-right">
              <Sparkles className="w-3.5 h-3.5 text-eerie-sage shrink-0" />
              <span>تصحيح ذكي بـ Gemini</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="w-full py-3.5 rounded-2xl bg-midnight-ink text-spectral-white font-bold text-sm hover:bg-midnight-ink/90 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 font-arabic mt-1"
          >
            <span>انضمام لجلسة المذاكرة مع أمير</span>
            <ArrowRight className="w-4 h-4 text-eerie-sage rotate-180" />
          </button>
        </form>

        {/* Bottom Security Note */}
        <div className="mt-4 pt-3 border-t border-stormy-slate/15 flex items-center justify-center gap-1.5 text-[11px] text-stormy-slate font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-eerie-sage" />
          <span>غرفة خاصة ومحمية بالكامل لصاحبها أمير</span>
        </div>
      </div>
    </div>
  );
};
