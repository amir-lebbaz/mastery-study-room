"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Lock,
  Coffee,
  Sparkles,
  Send,
  CheckCircle,
  HelpCircle,
  CupSoda,
  AlertOctagon,
} from "lucide-react";
import { TimerMode, StudentSlot, RoomMessage, StudentProgress } from "@/types";
import { soundService } from "@/lib/audio";
import { syncEngine } from "@/lib/supabase";

interface BreakLoungePanelProps {
  roomCode: string;
  timerMode: TimerMode;
  mySlot: StudentSlot;
  studentName: string;
  myProgress: StudentProgress;
  partnerProgress: StudentProgress;
  onOpenLifeline: () => void;
}

export const BreakLoungePanel: React.FC<BreakLoungePanelProps> = ({
  roomCode,
  timerMode,
  mySlot,
  studentName,
  myProgress,
  partnerProgress,
  onOpenLifeline,
}) => {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load existing room messages from Supabase Cloud
  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      const cloudMsgs = await syncEngine.fetchRoomMessages();
      if (isMounted && cloudMsgs.length > 0) {
        setMessages(cloudMsgs);
      }
    };

    loadMessages();

    const unsubscribe = syncEngine.subscribe("room_message_added", (newMsg) => {
      if (isMounted) {
        setMessages((prev) => {
          const msg = newMsg as RoomMessage;
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        soundService.playSignalPing();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [roomCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send One-Click Quick Signal to Supabase Cloud & Partner
  const sendQuickSignal = (signalText: string) => {
    syncEngine.addRoomMessage({
      room_id: roomCode,
      sender_slot: mySlot,
      sender_name: studentName,
      type: "signal",
      content: signalText,
    });

    soundService.playSignalPing();

    if (signalText.includes("Lifeline")) {
      onOpenLifeline();
    }
  };

  // Send Break Chat Message to Supabase Cloud & Partner
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || timerMode !== "break") return;

    syncEngine.addRoomMessage({
      room_id: roomCode,
      sender_slot: mySlot,
      sender_name: studentName,
      type: "chat",
      content: chatInput.trim(),
    });

    setChatInput("");
    soundService.playSignalPing();
  };

  return (
    <div className="bg-spectral-white text-midnight-ink rounded-3xl p-6 shadow-sm border border-stormy-slate/20 flex flex-col w-full lg:w-80 shrink-0 h-[740px] justify-between transition-all">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stormy-slate/15">
        <div className="flex items-center gap-2">
          {timerMode === "focus" ? (
            <Lock className="w-4 h-4 text-stormy-slate" />
          ) : (
            <Coffee className="w-4 h-4 text-eerie-sage animate-bounce" />
          )}
          <h3 className="text-sm font-bold text-midnight-ink">
            {timerMode === "focus" ? "Quick Signals (Locked)" : "Break Lounge (Unlocked)"}
          </h3>
        </div>
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
            timerMode === "focus"
              ? "bg-silver-fog/50 text-stormy-slate"
              : "bg-eerie-sage text-midnight-ink"
          }`}
        >
          {timerMode === "focus" ? "Focus Lock" : "Active"}
        </span>
      </div>

      {/* FOCUS MODE: 4 ONE-CLICK QUICK SIGNALS */}
      {timerMode === "focus" && (
        <div className="flex flex-col gap-2 my-3">
          <div className="text-[11px] font-semibold text-stormy-slate">
            المحادثة النصية مقفلة أثناء التركيز العميق. أرسل إشارات بنقرة واحدة:
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => sendQuickSignal("Finished Stage ✓")}
              className="p-2.5 rounded-xl bg-white/80 hover:bg-white text-midnight-ink text-xs font-semibold border border-stormy-slate/15 flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5 text-eerie-sage" />
              <span>أنهيت المرحلة</span>
            </button>

            <button
              onClick={() => sendQuickSignal(`Stuck on Stage ${myProgress.current_stage}`)}
              className="p-2.5 rounded-xl bg-white/80 hover:bg-white text-midnight-ink text-xs font-semibold border border-stormy-slate/15 flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
              <span>عالق في مسألة</span>
            </button>

            <button
              onClick={() => sendQuickSignal("Need Lifeline 🆘")}
              className="p-2.5 rounded-xl bg-white/80 hover:bg-white text-midnight-ink text-xs font-semibold border border-stormy-slate/15 flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
            >
              <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
              <span>طلب مساعدة</span>
            </button>

            <button
              onClick={() => sendQuickSignal("Taking a quick sip ☕")}
              className="p-2.5 rounded-xl bg-white/80 hover:bg-white text-midnight-ink text-xs font-semibold border border-stormy-slate/15 flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
            >
              <CupSoda className="w-3.5 h-3.5 text-sky-600" />
              <span>استراحة شرب</span>
            </button>
          </div>
        </div>
      )}

      {/* BREAK LOUNGE: ROUND SUMMARY */}
      {timerMode === "break" && (
        <div className="bg-eerie-sage/15 border border-eerie-sage/40 rounded-2xl p-3.5 my-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-midnight-ink mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-eerie-sage" />
            <span>ملخص الجولة (Round Summary)</span>
          </div>
          <div className="text-[11px] text-stormy-slate space-y-1">
            <div className="flex justify-between">
              <span>{myProgress.student_name}:</span>
              <span className="font-bold text-midnight-ink">
                تمرين {myProgress.current_exercise} • مرحلة {myProgress.current_stage}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{partnerProgress.student_name}:</span>
              <span className="font-bold text-midnight-ink">
                تمرين {partnerProgress.current_exercise} • مرحلة {partnerProgress.current_stage}
              </span>
            </div>
            <div className="pt-1.5 border-t border-stormy-slate/15 text-[10px] text-stormy-slate italic">
              💡 تحدثا الآن وناقشا نقاط الضعف والصعوبات التي واجهت كلاً منكما في الجولة السابقة!
            </div>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-xs text-stormy-slate p-4">
            ستظهر الإشارات والرسائل المتبادلة بينكما هنا بشكل حي ومباشر.
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2.5 rounded-xl text-xs flex flex-col gap-0.5 ${
                msg.type === "signal"
                  ? "bg-silver-fog/30 border border-stormy-slate/15"
                  : msg.sender_slot === mySlot
                  ? "bg-midnight-ink text-spectral-white self-end"
                  : "bg-white text-midnight-ink border border-stormy-slate/15"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold opacity-75">
                <span>{msg.sender_name}</span>
                <span>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
              </div>
              <div className="text-xs font-medium">{msg.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom: Chat Input with 50m Focus Lock State */}
      <div className="relative pt-2 border-t border-stormy-slate/15">
        {timerMode === "focus" && (
          <div className="absolute inset-0 bg-silver-fog/80 backdrop-blur-[1px] rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-stormy-slate z-20">
            <Lock className="w-3.5 h-3.5 text-stormy-slate" />
            <span>المحادثة الحرة تفتح تلقائياً في استراحة الـ 10 دقائق</span>
          </div>
        )}

        <form onSubmit={handleSendChat} className="flex items-center gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={timerMode === "focus"}
            placeholder={timerMode === "focus" ? "مقفلة أثناء التركيز..." : "اكتب لزميلك أثناء الاستراحة..."}
            className="flex-1 bg-white/90 border border-stormy-slate/20 rounded-xl px-3 py-2 text-xs text-midnight-ink outline-hidden focus:border-eerie-sage"
          />
          <button
            type="submit"
            disabled={timerMode === "focus" || !chatInput.trim()}
            className="p-2 rounded-xl bg-midnight-ink text-spectral-white hover:bg-midnight-ink/90 disabled:opacity-40 transition-all shadow-xs"
          >
            <Send className="w-3.5 h-3.5 text-eerie-sage" />
          </button>
        </form>
      </div>
    </div>
  );
};
