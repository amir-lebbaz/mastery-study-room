"use client";

import React, { useState } from "react";
import { Users, Crown, User, UserX, Share2, Check } from "lucide-react";
import { RoomParticipant, StudentSlot } from "@/types";
import { soundService } from "@/lib/audio";

interface LiveRosterCardProps {
  participants: RoomParticipant[];
  myUserId: string;
  mySlot: StudentSlot;
  roomCode: string;
  onKickUser?: (userId: string, name: string) => void;
}

export const LiveRosterCard: React.FC<LiveRosterCardProps> = ({
  participants,
  myUserId,
  mySlot,
  roomCode,
  onKickUser,
}) => {
  const isHost = mySlot === "A";
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/?invite=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    soundService.playSignalPing();
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const activeCount = participants.filter((p) => p.is_online).length;

  return (
    <div className="bg-spectral-white text-midnight-ink rounded-3xl p-5 shadow-sm border border-stormy-slate/20 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stormy-slate/15 mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-midnight-ink" />
          <h3 className="text-sm font-extrabold text-midnight-ink font-arabic">
            المتواجدون في الغرفة
          </h3>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{activeCount} متصل</span>
        </span>
      </div>

      {/* Participants List */}
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px] pr-0.5">
        {participants.length === 0 ? (
          <div className="py-4 text-center text-xs text-stormy-slate">
            جاري استطلاع المتواجدين في الغرفة...
          </div>
        ) : (
          participants.map((p) => {
            const isMe = p.user_id === myUserId;
            const pIsHost = p.role === "host";

            return (
              <div
                key={p.user_id}
                className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isMe
                    ? "bg-midnight-ink/5 border-midnight-ink/20"
                    : "bg-white border-stormy-slate/15 hover:border-stormy-slate/30"
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      pIsHost
                        ? "bg-midnight-ink text-spectral-white shadow-2xs"
                        : "bg-stormy-slate/20 text-midnight-ink"
                    }`}
                  >
                    {pIsHost ? (
                      <Crown className="w-4 h-4 text-eerie-sage" />
                    ) : (
                      <User className="w-4 h-4 text-stormy-slate" />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-midnight-ink truncate">
                        {p.display_name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-eerie-sage/30 text-midnight-ink">
                          أنت
                        </span>
                      )}
                      {pIsHost && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-midnight-ink text-spectral-white">
                          المسؤول
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-stormy-slate mt-0.5">
                      <span className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.is_online ? "bg-emerald-500" : "bg-stormy-slate/40"
                          }`}
                        />
                        <span>{p.is_online ? "متصل الآن" : "غير متصل"}</span>
                      </span>
                      <span>•</span>
                      <span>
                        تمرين {p.current_exercise || 1} (مرحلة {p.current_stage || 1}/3)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Host Action: Kick guest */}
                {isHost && !isMe && onKickUser && (
                  <button
                    type="button"
                    onClick={() => onKickUser(p.user_id, p.display_name)}
                    className="p-1.5 rounded-xl text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all shrink-0"
                    title={`طرد ${p.display_name} من الغرفة`}
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Host Share Link Button */}
      {isHost && (
        <div className="pt-3 mt-3 border-t border-stormy-slate/15">
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full py-2 px-3 rounded-xl bg-midnight-ink text-spectral-white hover:bg-midnight-ink/90 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-eerie-sage" />
                <span className="text-eerie-sage">تم نسخ رابط الدعوة!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-eerie-sage" />
                <span>نسخ رابط دعوة الزملاء</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
