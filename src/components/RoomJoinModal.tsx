"use client";

import React, { useState } from "react";
import { Users, Sparkles, ArrowRight, Crown, Lock, X } from "lucide-react";
import { StudentSlot } from "@/types";

interface RoomJoinModalProps {
  isOpen: boolean;
  onJoin: (code: string, slot: StudentSlot, name: string) => void;
  onClose?: () => void;
}

export const RoomJoinModal: React.FC<RoomJoinModalProps> = ({ isOpen, onJoin, onClose }) => {
  const [code, setCode] = useState("8921");
  const [slot, setSlot] = useState<StudentSlot>("B");
  const [name, setName] = useState("");
  const [hostPasscode, setHostPasscode] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!code.trim() || !name.trim()) {
      setError("يرجى ملء جميع الحقول المطلوبة.");
      return;
    }

    if (slot === "A") {
      // Host authentication check
      const validKeys = ["amir", "amir2026", "2026", "host"];
      if (!validKeys.includes(hostPasscode.trim().toLowerCase())) {
        setError("رمز تأكيد صاحب الغرفة غير صحيح. صلاحيات الإدارة خاصة بأمير فقط.");
        return;
      }
    }

    onJoin(code.trim().toUpperCase(), slot, name.trim());
  };

  return (
    <div className="fixed inset-0 bg-midnight-ink/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-spectral-white text-midnight-ink rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stormy-slate/20 transition-all relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 left-5 text-stormy-slate hover:text-midnight-ink p-1 rounded-full hover:bg-stormy-slate/10"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-midnight-ink text-spectral-white flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-eerie-sage" />
          </div>
          <div>
            <h2 className="text-lg font-black text-midnight-ink">إعدادات الهوية والدخول</h2>
            <p className="text-xs text-stormy-slate">غرفة دراسية تفاعلية ثنائية</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Room Code */}
          <div>
            <label className="block text-xs font-bold text-midnight-ink mb-1.5 uppercase tracking-wider">
              كود الغرفة (Room Code)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="مثال: 8921"
              maxLength={8}
              className="w-full bg-white border border-stormy-slate/30 rounded-2xl px-4 py-2.5 text-sm font-mono font-bold text-midnight-ink outline-hidden focus:border-midnight-ink uppercase"
              required
            />
          </div>

          {/* Student Name */}
          <div>
            <label className="block text-xs font-bold text-midnight-ink mb-1.5 uppercase tracking-wider">
              اسمك (Display Name)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اكتب اسمك هنا..."
              className="w-full bg-white border border-stormy-slate/30 rounded-2xl px-4 py-2.5 text-sm font-semibold text-midnight-ink outline-hidden focus:border-midnight-ink"
              required
            />
          </div>

          {/* Role / Slot Selection */}
          <div>
            <label className="block text-xs font-bold text-midnight-ink mb-1.5 uppercase tracking-wider">
              حدد دورك في الغرفة (Role)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSlot("B");
                  setError("");
                }}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  slot === "B"
                    ? "bg-midnight-ink text-spectral-white border-midnight-ink shadow-sm"
                    : "bg-white text-midnight-ink border-stormy-slate/20 hover:border-stormy-slate/40"
                }`}
              >
                <Users className="w-5 h-5 text-eerie-sage" />
                <span className="text-xs font-black">طالب مدعو (Guest)</span>
                <span className={`text-[10px] ${slot === "B" ? "text-stormy-slate" : "text-stormy-slate/80"}`}>
                  الانضمام للدراسة مع صاحب الغرفة
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSlot("A");
                  setError("");
                }}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  slot === "A"
                    ? "bg-midnight-ink text-spectral-white border-midnight-ink shadow-sm"
                    : "bg-white text-midnight-ink border-stormy-slate/20 hover:border-stormy-slate/40"
                }`}
              >
                <Crown className="w-5 h-5 text-eerie-sage" />
                <span className="text-xs font-black">أمير (Host)</span>
                <span className={`text-[10px] ${slot === "A" ? "text-stormy-slate" : "text-stormy-slate/80"}`}>
                  يتطلب رمز التحقق الخاص بصاحب الغرفة
                </span>
              </button>
            </div>
          </div>

          {/* If Slot A selected: require Host Passcode */}
          {slot === "A" && (
            <div className="animate-in fade-in duration-200">
              <label className="block text-xs font-bold text-midnight-ink mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-midnight-ink" />
                <span>رمز تأكيد صاحب الغرفة (Host Passcode)</span>
              </label>
              <input
                type="password"
                value={hostPasscode}
                onChange={(e) => setHostPasscode(e.target.value)}
                placeholder="ادخل الرمز السري..."
                className="w-full bg-white border border-stormy-slate/30 rounded-2xl px-4 py-2.5 text-sm font-mono font-bold text-midnight-ink outline-hidden focus:border-midnight-ink"
                required
              />
              <span className="text-[10px] text-stormy-slate block mt-1">
                الصلاحيات الكاملة للغرفة محصورة لصاحبها أمير فقط.
              </span>
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-2xl bg-midnight-ink text-spectral-white font-bold text-sm hover:bg-midnight-ink/90 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>حفظ والدخول</span>
            <ArrowRight className="w-4 h-4 text-eerie-sage" />
          </button>
        </form>
      </div>
    </div>
  );
};
