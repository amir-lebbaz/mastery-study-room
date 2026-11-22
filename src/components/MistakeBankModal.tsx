"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle, X, ShieldAlert, CheckCircle2, Check } from "lucide-react";
import { StudentProgress, MistakeRecord } from "@/types";
import { syncEngine } from "@/lib/supabase";

interface MistakeBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  myProgress: StudentProgress;
  partnerProgress: StudentProgress;
}

export const MistakeBankModal: React.FC<MistakeBankModalProps> = ({
  isOpen,
  onClose,
  myProgress,
  partnerProgress,
}) => {
  const [dbMistakes, setDbMistakes] = useState<MistakeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMistakes = useCallback(async () => {
    setIsLoading(true);
    const records = await syncEngine.fetchMistakes();
    setDbMistakes(records);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadMistakes();
      const unsub = syncEngine.subscribe("mistake_bank_updated", () => {
        loadMistakes();
      });
      return () => unsub();
    }
  }, [isOpen, loadMistakes]);

  if (!isOpen) return null;

  // Combine DB records with in-memory progress mistakes if not yet persisted
  const combinedMistakes: Array<{
    id?: string;
    exercise: number;
    stage: number;
    weakness: string;
    author: string;
    timestamp: string;
    resolved: boolean;
  }> = [];

  if (dbMistakes.length > 0) {
    dbMistakes.forEach((m) => {
      combinedMistakes.push({
        id: m.id,
        exercise: m.exercise_index,
        stage: m.stage || 1,
        weakness: m.weakness_summary,
        author: m.student_slot === "A" ? "Amir (Host)" : "Student B",
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        resolved: m.resolved,
      });
    });
  } else {
    (myProgress.mistakes || []).forEach((m) => {
      combinedMistakes.push({
        exercise: m.exercise,
        stage: m.stage,
        weakness: m.weakness,
        author: myProgress.student_name,
        timestamp: m.timestamp,
        resolved: false,
      });
    });
    (partnerProgress.mistakes || []).forEach((m) => {
      combinedMistakes.push({
        exercise: m.exercise,
        stage: m.stage,
        weakness: m.weakness,
        author: partnerProgress.student_name,
        timestamp: m.timestamp,
        resolved: false,
      });
    });
  }

  const handleResolve = async (id?: string) => {
    if (!id) return;
    await syncEngine.resolveMistake(id);
    setDbMistakes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, resolved: true } : item))
    );
  };

  return (
    <div className="fixed inset-0 bg-midnight-ink/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-spectral-white text-midnight-ink rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stormy-slate/20 transition-all flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between pb-3 border-b border-stormy-slate/15 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-midnight-ink" />
            <h2 className="text-base font-bold text-midnight-ink font-arabic">بنك الأخطاء المشترك (Mistake Bank)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stormy-slate hover:text-midnight-ink hover:bg-silver-fog/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stormy-slate mb-3 font-arabic">
          سجل الثغرات والمفاهيم غير المتقنة أثناء الحل للمراجعة الثنائية والتثبيت خلال استراحة الـ 10 دقائق:
        </p>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-xs text-stormy-slate font-arabic">
              جاري تحميل الأخطاء المسجلة...
            </div>
          ) : combinedMistakes.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-xs text-stormy-slate gap-2">
              <CheckCircle2 className="w-8 h-8 text-eerie-sage opacity-80" />
              <p className="font-semibold text-midnight-ink font-arabic">بنك الأخطاء نظيف تماماً</p>
              <p className="font-arabic">لم يتم تسجيل أي ثغرات مفاهيمية حرجة حتى الآن. استمروا بنفس الإتقان!</p>
            </div>
          ) : (
            combinedMistakes.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`p-3.5 rounded-2xl bg-white border flex flex-col gap-1 text-xs transition-all ${
                  item.resolved ? "opacity-60 border-emerald-300 bg-emerald-50/30" : "border-stormy-slate/15"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-midnight-ink flex items-center gap-1.5 font-mono">
                    <ShieldAlert className={`w-3.5 h-3.5 ${item.resolved ? "text-emerald-600" : "text-amber-600"}`} />
                    Exercise {item.exercise} • Stage {item.stage}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-stormy-slate">{item.timestamp}</span>
                    {item.id && !item.resolved && (
                      <button
                        onClick={() => handleResolve(item.id)}
                        className="px-2 py-0.5 rounded-md bg-eerie-sage/20 hover:bg-eerie-sage/40 text-[10px] font-bold text-midnight-ink flex items-center gap-1 transition-all"
                      >
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>تم الإتقان</span>
                      </button>
                    )}
                    {item.resolved && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        معالج ✓
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-stormy-slate font-medium text-xs mt-0.5 font-arabic">
                  نقطة الضعف: <span className="text-midnight-ink font-semibold">{item.weakness}</span>
                </div>
                <div className="text-[10px] text-stormy-slate italic mt-0.5">
                  Logged by {item.author}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-stormy-slate/15 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-midnight-ink text-spectral-white text-xs font-bold hover:bg-midnight-ink/90 active:scale-95 transition-all shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
