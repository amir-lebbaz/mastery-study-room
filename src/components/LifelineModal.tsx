"use client";

import React, { useState } from "react";
import { LifeBuoy, X, Send, Sparkles, RotateCw } from "lucide-react";
import { StudentSlot } from "@/types";
import { soundService } from "@/lib/audio";
import { syncEngine } from "@/lib/supabase";

interface LifelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  mySlot: StudentSlot;
  studentName: string;
  stageNumber: number;
  exerciseIndex?: number;
  sourceTitle?: string;
  partnerPassedStage?: boolean;
}

export const LifelineModal: React.FC<LifelineModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  mySlot,
  studentName,
  stageNumber,
  exerciseIndex = 1,
  sourceTitle = "",
  partnerPassedStage = false,
}) => {
  const [hint, setHint] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);

  if (!isOpen) return null;

  // Count words
  const words = hint.trim() ? hint.trim().split(/\s+/) : [];
  const wordCount = words.length;
  const isOverLimit = wordCount > 15;

  const handleSendHint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hint.trim() || isOverLimit) return;

    soundService.playSignalPing();

    syncEngine.addRoomMessage({
      room_id: roomCode,
      sender_slot: mySlot,
      sender_name: studentName,
      type: "lifeline",
      content: `💡 Peer Lifeline (Stage ${stageNumber}): "${hint.trim()}"`,
    });

    onClose();
  };

  const handleRequestAiHint = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          exerciseIndex,
          stage: stageNumber,
          sourceTitle,
          userPrompt: `Provide an ultra-concise, high-leverage conceptual hint strictly capped at 15 words for Stage ${stageNumber}. Do NOT solve the problem or reveal numeric answers. Write the hint in clear Arabic with English key terms.`,
        }),
      });
      const data = await res.json();
      if (data.content) {
        setAiHint(data.content);
        soundService.playSignalPing();
        // Also broadcast to room messages so both see the lifeline was used
        syncEngine.addRoomMessage({
          room_id: roomCode,
          sender_slot: mySlot,
          sender_name: "Gemini AI Lifeline",
          type: "lifeline",
          content: `🤖 AI Hint Fallback (Stage ${stageNumber}): ${data.content}`,
        });
      }
    } catch (e) {
      console.error("AI hint error:", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-midnight-ink/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-spectral-white text-midnight-ink rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stormy-slate/20 transition-all font-arabic">
        <div className="flex items-center justify-between pb-3 border-b border-stormy-slate/15 mb-4">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-midnight-ink" />
            <h2 className="text-base font-bold text-midnight-ink">
              طوق النجاة (Lifeline - Stage {stageNumber})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stormy-slate hover:text-midnight-ink hover:bg-silver-fog/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {partnerPassedStage ? (
          <>
            <p className="text-xs text-stormy-slate mb-3 leading-relaxed">
              لقد تجاوز زميلك هذه المرحلة بنجاح! اكتب له تلميحاً مفاهيمياً ذكياً بحد أقصى <strong>15 كلمة فقط</strong> دون إعطاء الحل المباشر:
            </p>

            <form onSubmit={handleSendHint} className="flex flex-col gap-3">
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="مثال: ركز على تطبيق صيغة نيوتن على المشتقة الأولى وتأكد من إشارة الطرح."
                rows={3}
                className={`w-full bg-white border rounded-2xl p-3 text-xs sm:text-sm text-midnight-ink outline-hidden transition-all ${
                  isOverLimit ? "border-amber-600 focus:border-amber-600" : "border-stormy-slate/30 focus:border-midnight-ink"
                }`}
              />

              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-mono font-bold ${
                    isOverLimit ? "text-amber-600" : wordCount > 12 ? "text-amber-700" : "text-stormy-slate"
                  }`}
                >
                  {wordCount} / 15 words
                </span>
                {isOverLimit && (
                  <span className="text-amber-600 font-semibold text-[11px]">
                    يرجى حذف {wordCount - 15} كلمة
                  </span>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-stormy-slate/20 text-xs font-bold text-stormy-slate hover:text-midnight-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!hint.trim() || isOverLimit}
                  className="flex-1 py-2.5 rounded-xl bg-midnight-ink text-spectral-white text-xs font-bold hover:bg-midnight-ink/90 disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Send className="w-3.5 h-3.5 text-eerie-sage" />
                  <span>إرسال التلميح</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="p-3.5 rounded-2xl bg-silver-fog/30 border border-stormy-slate/20 text-xs text-stormy-slate leading-relaxed">
              <p className="font-bold text-midnight-ink mb-1">
                الزميل لم يتجاوز هذه المرحلة بعد (AI Fallback Active)
              </p>
              بما أن زميلك لا يزال في نفس المرحلة أو قبلها، يمكنك طلب تلميح ذكي وموجز (15 كلمة) مباشرة من الذكاء الاصطناعي لمساعدتك دون حرق الحل:
            </div>

            {aiHint ? (
              <div className="p-4 rounded-2xl bg-eerie-sage/20 border border-eerie-sage/40 text-xs text-midnight-ink leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-midnight-ink mb-1">
                  <Sparkles className="w-4 h-4 text-eerie-sage" />
                  <span>تلميح الذكاء الاصطناعي (AI Hint):</span>
                </div>
                <p className="font-medium">{aiHint}</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRequestAiHint}
                disabled={isAiLoading}
                className="w-full py-3 rounded-2xl bg-midnight-ink text-spectral-white text-xs font-bold hover:bg-midnight-ink/90 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {isAiLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-eerie-sage" />
                    <span>جاري توليد التلميح الذكي...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-eerie-sage" />
                    <span>توليد تلميح فوري من الذكاء الاصطناعي</span>
                  </>
                )}
              </button>
            )}

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-silver-fog/40 text-xs font-bold text-midnight-ink hover:bg-silver-fog/60"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
