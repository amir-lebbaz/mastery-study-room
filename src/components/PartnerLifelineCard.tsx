"use client";

import React from "react";
import { LifeBuoy, HeartPulse } from "lucide-react";
import { StudentProgress } from "@/types";

interface PartnerLifelineCardProps {
  myProgress: StudentProgress;
  partnerProgress: StudentProgress;
  onOpenLifeline: () => void;
}

export const PartnerLifelineCard: React.FC<PartnerLifelineCardProps> = ({
  myProgress,
  partnerProgress,
  onOpenLifeline,
}) => {
  const score = myProgress.last_score || 0;
  const strikes = myProgress.strikes || 0;

  const partnerPassedStage =
    partnerProgress.current_exercise > myProgress.current_exercise ||
    (partnerProgress.current_exercise === myProgress.current_exercise &&
      partnerProgress.current_stage > myProgress.current_stage);

  const canRequestLifeline = strikes >= 2;
  const isPeerEligible = strikes >= 2 && partnerPassedStage;
  const isAiFallback = strikes >= 2 && !partnerPassedStage;

  // Circular ring calculations for score / 10
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 10);

  return (
    <div className="bg-spectral-white text-midnight-ink rounded-3xl p-5 shadow-sm border border-stormy-slate/20 flex flex-col justify-between h-full min-h-[195px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-midnight-ink" />
          <h2 className="text-sm sm:text-base font-extrabold text-midnight-ink font-arabic">
            معيار الإتقان وشريان النجاة
          </h2>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full font-arabic ${
            score >= 9
              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
              : score > 0
              ? "bg-stormy-slate/20 text-stormy-slate"
              : "bg-silver-fog/50 text-stormy-slate"
          }`}
        >
          {score >= 9 ? "تم الإتقان (>= 9)" : "قيد الإنجاز"}
        </span>
      </div>

      {/* Middle: Score Ring & Strike Counter */}
      <div className="flex items-center justify-between my-2">
        {/* Score Ring */}
        <div className="relative flex items-center justify-center">
          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 70 70">
            <circle
              cx="35"
              cy="35"
              r={radius}
              stroke="#536372"
              strokeWidth="5"
              fill="transparent"
              className="opacity-20"
            />
            <circle
              cx="35"
              cy="35"
              r={radius}
              stroke={score >= 9 ? "#899C96" : "#536372"}
              strokeWidth="5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-lg font-black font-mono text-midnight-ink">{score}</span>
            <span className="text-[8px] text-stormy-slate font-bold">/ 10</span>
          </div>
        </div>

        {/* Strike Counter */}
        <div className="flex flex-col items-end gap-1 font-arabic">
          <div className="text-xs font-bold text-midnight-ink">
            الإنذارات (Strikes): <span className="font-mono text-midnight-ink font-black">({strikes}/3)</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  strikes >= num
                    ? "bg-midnight-ink text-spectral-white scale-110 shadow-xs"
                    : "bg-silver-fog/50 text-stormy-slate/60 border border-stormy-slate/20"
                }`}
              >
                {strikes >= num ? "✕" : num}
              </div>
            ))}
          </div>
          <span className="text-[10px] text-stormy-slate text-left">
            {strikes >= 3
              ? "إعادة المحاولة من البداية"
              : strikes === 2
              ? "إنذار واحد متبقٍ قبل التراجع"
              : "اجتياز المرحلة يتطلب 9/10 على الأقل"}
          </span>
        </div>
      </div>

      {/* Peer Lifeline Action Button */}
      <div className="pt-2 border-t border-stormy-slate/15">
        <button
          onClick={onOpenLifeline}
          disabled={!canRequestLifeline}
          className={`w-full py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-xs font-arabic ${
            canRequestLifeline
              ? "bg-eerie-sage text-midnight-ink hover:bg-eerie-sage/90 active:scale-95 animate-pulse border border-midnight-ink/20"
              : "bg-silver-fog/30 text-stormy-slate/60 cursor-not-allowed border border-stormy-slate/10"
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>
            {isPeerEligible
              ? "طلب تلميح من الزميل (15 كلمة)"
              : isAiFallback
              ? "طلب تلميح ذكي من المعلم"
              : "شريان النجاة (يفتح عند إنذارين)"}
          </span>
        </button>
      </div>
    </div>
  );
};
