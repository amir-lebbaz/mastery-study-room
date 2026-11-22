"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { PomodoroHeroCard } from "@/components/PomodoroHeroCard";
import { RoadmapCard } from "@/components/RoadmapCard";
import { PartnerLifelineCard } from "@/components/PartnerLifelineCard";
import { LiveRosterCard } from "@/components/LiveRosterCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { BreakLoungePanel } from "@/components/BreakLoungePanel";
import { RoomJoinModal } from "@/components/RoomJoinModal";
import { GuestLoginModal } from "@/components/GuestLoginModal";
import { SourceUploadModal } from "@/components/SourceUploadModal";
import { MistakeBankModal } from "@/components/MistakeBankModal";
import { LifelineModal } from "@/components/LifelineModal";
import {
  StudentSlot,
  StudentProgress,
  RoomState,
  RoadmapExercise,
  RoomParticipant,
  LayoutVisibility,
  ToastNotification,
  UserRole,
} from "@/types";
import { syncEngine } from "@/lib/supabase";
import {
  AlertTriangle,
  LogIn,
  Crown,
  FolderOpen,
  Play,
  Pause,
  RotateCcw,
  Share2,
  Check,
  X,
} from "lucide-react";
import { soundService } from "@/lib/audio";

const getOrCreateUserId = (): string => {
  if (typeof window === "undefined") return "usr-temp";
  let uid = localStorage.getItem("mastery_user_id");
  if (!uid) {
    uid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`;
    localStorage.setItem("mastery_user_id", uid);
  }
  return uid;
};

const defaultLayout: LayoutVisibility = {
  showSidebar: true,
  showPomodoro: true,
  showStatsRow: true,
  showBreakLounge: true,
  zenMode: false,
};

export default function Home() {
  const [roomCode, setRoomCode] = useState<string>("8921");
  const [mySlot, setMySlot] = useState<StudentSlot>("A"); // 'A' = Host/Owner, 'B' = Guest
  const [studentName, setStudentName] = useState<string>("Amir (Host)");
  const [myUserId, setMyUserId] = useState<string>("usr-amir");
  const [activeTab, setActiveTab] = useState<"study" | "sources" | "mistakes" | "settings">("study");

  // Layout Preferences
  const [layout, setLayout] = useState<LayoutVisibility>(defaultLayout);
  const [miniTimerText, setMiniTimerText] = useState<string>("50:00");
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Multi-User Roster & Toast Notifications
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Kicked by Host banner
  const [isKicked, setIsKicked] = useState<boolean>(false);

  // Modals
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);
  const [isGuestLoginOpen, setIsGuestLoginOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isMistakesModalOpen, setIsMistakesModalOpen] = useState<boolean>(false);
  const [isLifelineModalOpen, setIsLifelineModalOpen] = useState<boolean>(false);

  // Room's Active Course Source & Sequential Roadmap (synced across cloud)
  const [roadmap, setRoadmap] = useState<RoadmapExercise[]>([]);
  const [currentExercise, setCurrentExercise] = useState<number>(1);
  const [courseTitle, setCourseTitle] = useState<string>("");

  // Room State (Pomodoro)
  const [roomState, setRoomState] = useState<RoomState>({
    id: "97f428b7-dfc6-4263-83d9-ae6a770f245b",
    code: "8921",
    timer_mode: "focus",
    timer_seconds_remaining: 3000,
    timer_ends_at: null,
    paused_remaining_seconds: 3000,
    is_running: false,
    active_source_name: "",
  });

  // Progress for current user and primary partner
  const [myProgress, setMyProgress] = useState<StudentProgress>({
    id: "prog-A",
    room_id: "8921",
    student_slot: "A",
    student_name: "Amir (Host)",
    current_exercise: 1,
    current_stage: 1,
    strikes: 0,
    last_score: 0,
    passed_stages: [],
    mistakes: [],
    is_online: true,
    last_seen_at: new Date().toISOString(),
  });

  const [partnerProgress, setPartnerProgress] = useState<StudentProgress>({
    id: "prog-B",
    room_id: "8921",
    student_slot: "B",
    student_name: "الزميل المدعو",
    current_exercise: 1,
    current_stage: 1,
    strikes: 0,
    last_score: 0,
    passed_stages: [],
    mistakes: [],
    is_online: false,
    last_seen_at: new Date().toISOString(),
  });

  // Toast Notification helper
  const addToast = useCallback((message: string, type: "join" | "leave" | "info" | "error" = "info") => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const timestamp = Date.now();
    setToasts((prev) => [...prev, { id, message, type, timestamp }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Layout updates
  const handleUpdateLayout = (key: keyof LayoutVisibility, value: boolean) => {
    setLayout((prev) => {
      const updated = { ...prev, [key]: value };
      if (typeof window !== "undefined") {
        localStorage.setItem("mastery_layout", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleToggleZenMode = () => {
    setLayout((prev) => {
      const updated = { ...prev, zenMode: !prev.zenMode };
      if (typeof window !== "undefined") {
        localStorage.setItem("mastery_layout", JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Initialize Room & Cloud Sync
  const initializeRoomConnection = useCallback(
    async (code: string, slot: StudentSlot, name: string, uid: string) => {
      try {
        const myRole: UserRole = slot === "A" ? "host" : "guest";
        const liveData = await syncEngine.initRoom(code, slot, name, uid, myRole, currentExercise, 1);

        setRoomState((prev) => ({
          ...prev,
          code: liveData.code,
          timer_mode: liveData.timer_mode,
          timer_seconds_remaining: liveData.timer_seconds_remaining,
          timer_ends_at: liveData.timer_ends_at,
          paused_remaining_seconds: liveData.paused_remaining_seconds,
          is_running: liveData.is_running,
          active_source_name: liveData.active_source_title,
        }));

        if (liveData.active_source_title && liveData.active_roadmap.length > 0) {
          setCourseTitle(liveData.active_source_title);
          setRoadmap(liveData.active_roadmap);
        }
      } catch (e) {
        console.error("Failed to connect room:", e);
      }
    },
    [currentExercise]
  );

  // Parse URL join parameters and initialize on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const uid = getOrCreateUserId();
      setMyUserId(uid);

      // Load saved layout
      const savedLayoutStr = localStorage.getItem("mastery_layout");
      if (savedLayoutStr) {
        try {
          const parsed = JSON.parse(savedLayoutStr);
          setLayout((prev) => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error("Failed to parse saved layout:", e);
        }
      }

      const urlParams = new URLSearchParams(window.location.search);
      const inviteParam = urlParams.get("invite") || urlParams.get("join") || urlParams.get("room");
      const slotParam = urlParams.get("slot") as StudentSlot | null;

      const isInvited = Boolean(inviteParam || slotParam === "B");
      const savedCode = inviteParam || localStorage.getItem("mastery_room_code") || "8921";
      const storedName = localStorage.getItem("mastery_name");

      setRoomCode(savedCode);

      if (isInvited) {
        // Guest Flow: strictly assigned to Slot B
        setMySlot("B");
        const hasValidCustomName =
          storedName &&
          storedName !== "Student B" &&
          storedName !== "Student B (Partner)";

        if (hasValidCustomName) {
          setStudentName(storedName);
          setMyProgress((prev) => ({
            ...prev,
            room_id: savedCode,
            student_slot: "B",
            student_name: storedName,
            user_id: uid,
            role: "guest",
          }));
          setPartnerProgress((prev) => ({
            ...prev,
            room_id: savedCode,
            student_slot: "A",
            student_name: "أمير (صاحب الغرفة)",
          }));
          initializeRoomConnection(savedCode, "B", storedName, uid);
        } else {
          // Open the Guest Login Portal so guest enters username
          setIsGuestLoginOpen(true);
        }
      } else {
        // Host Flow (Amir - Slot A)
        const savedSlot = (localStorage.getItem("mastery_slot") as StudentSlot) || "A";
        const savedName = storedName || "أمير (صاحب الغرفة)";

        setMySlot(savedSlot);
        setStudentName(savedName);

        setMyProgress((prev) => ({
          ...prev,
          room_id: savedCode,
          student_slot: savedSlot,
          student_name: savedName,
          user_id: uid,
          role: "host",
        }));

        setPartnerProgress((prev) => ({
          ...prev,
          room_id: savedCode,
          student_slot: savedSlot === "A" ? "B" : "A",
          student_name: savedSlot === "A" ? "بانتظار انضمام الزملاء..." : "أمير (صاحب الغرفة)",
        }));

        initializeRoomConnection(savedCode, savedSlot, savedName, uid);
      }
    }
  }, [initializeRoomConnection]);

  // Subscribe to live multi-device broadcasts & realtime presence updates
  useEffect(() => {
    // 1. Unified Realtime Presence Roster
    const unsubRoster = syncEngine.subscribe("participants_sync", (data) => {
      const roster = data as RoomParticipant[];
      setParticipants(roster);

      // Also update primary partner progress if available
      const guestParticipant = roster.find((p) => p.user_id !== myUserId);
      if (guestParticipant) {
        setPartnerProgress((prev) => ({
          ...prev,
          student_name: guestParticipant.display_name,
          current_exercise: guestParticipant.current_exercise,
          current_stage: guestParticipant.current_stage,
          is_online: guestParticipant.is_online,
        }));
      }
    });

    const unsubJoined = syncEngine.subscribe("participant_joined", (data: any) => {
      soundService.playSignalPing();
      addToast(`انضم ${data.display_name || "عضو جديد"} إلى الغرفة 🟢`, "join");
    });

    const unsubLeft = syncEngine.subscribe("participant_left", (data: any) => {
      addToast(`غادر ${data.display_name || "أحد الأعضاء"} الغرفة ⚪`, "leave");
    });

    const unsubKicked = syncEngine.subscribe("user_kicked", (data: any) => {
      if (data.user_id === myUserId) {
        setIsKicked(true);
      }
    });

    // 2. Room state polled from database (Pomodoro)
    const unsubRoomPolled = syncEngine.subscribe("room_state_polled", (data) => {
      const rs = data as RoomState;
      setRoomState((prev) => {
        if (prev.timer_mode !== rs.timer_mode || prev.is_running !== rs.is_running) {
          return { ...prev, ...rs };
        }
        return prev;
      });
    });

    // 3. Instant Realtime Broadcasts
    const unsubRealtimeTimer = syncEngine.subscribe("room_state_updated", (data) => {
      setRoomState(data as RoomState);
    });

    const unsubRealtimeSource = syncEngine.subscribe("source_updated", (data) => {
      const { fileName, roadmap: newRoadmap } = data as { fileName: string; roadmap: RoadmapExercise[] };
      setCourseTitle(fileName);
      setRoadmap(newRoadmap || []);
      setCurrentExercise(1);
    });

    const unsubRealtimeProgress = syncEngine.subscribe("student_progress_updated", (data) => {
      const prog = data as StudentProgress;
      if (prog.student_slot === mySlot) {
        setMyProgress(prog);
      } else {
        setPartnerProgress(prog);
      }
    });

    const unsubPartnerKicked = syncEngine.subscribe("partner_kicked", () => {
      if (mySlot === "B") {
        setIsKicked(true);
      }
    });

    return () => {
      unsubRoster();
      unsubJoined();
      unsubLeft();
      unsubKicked();
      unsubRoomPolled();
      unsubRealtimeTimer();
      unsubRealtimeSource();
      unsubRealtimeProgress();
      unsubPartnerKicked();
    };
  }, [mySlot, myUserId, addToast]);

  // Handle Guest Login from dedicated modal
  const handleGuestJoin = async (guestName: string) => {
    const uid = myUserId || getOrCreateUserId();
    if (typeof window !== "undefined") {
      localStorage.setItem("mastery_room_code", roomCode);
      localStorage.setItem("mastery_slot", "B");
      localStorage.setItem("mastery_name", guestName);
    }

    setMySlot("B");
    setStudentName(guestName);
    setIsGuestLoginOpen(false);

    setMyProgress((prev) => ({
      ...prev,
      room_id: roomCode,
      student_slot: "B",
      student_name: guestName,
      user_id: uid,
      role: "guest",
      is_online: true,
    }));

    setPartnerProgress((prev) => ({
      ...prev,
      room_id: roomCode,
      student_slot: "A",
      student_name: "أمير (صاحب الغرفة)",
    }));

    await initializeRoomConnection(roomCode, "B", guestName, uid);

    // Broadcast arrival signal into the chat
    syncEngine.addRoomMessage({
      room_id: roomCode,
      sender_slot: "B",
      sender_name: guestName,
      type: "signal",
      content: `👋 انضم ${guestName} إلى جلسة المذاكرة مع أمير! 🤝`,
    });
  };

  // Handle Room Join / Role switch from Settings
  const handleJoin = (newCode: string, newSlot: StudentSlot, newName: string) => {
    const uid = myUserId || getOrCreateUserId();
    setRoomCode(newCode);
    setMySlot(newSlot);
    setStudentName(newName);
    setIsKicked(false);

    if (typeof window !== "undefined") {
      localStorage.setItem("mastery_room_code", newCode);
      localStorage.setItem("mastery_slot", newSlot);
      localStorage.setItem("mastery_name", newName);
    }

    setMyProgress((prev) => ({
      ...prev,
      room_id: newCode,
      student_slot: newSlot,
      student_name: newName,
      user_id: uid,
      role: newSlot === "A" ? "host" : "guest",
    }));

    initializeRoomConnection(newCode, newSlot, newName, uid);
    setIsJoinModalOpen(false);
  };

  // Host updates course source
  const handleRoadmapUpdated = (newRoadmap: RoadmapExercise[], fileName: string) => {
    setRoadmap(newRoadmap);
    setCourseTitle(fileName);
    setCurrentExercise(1);
    setRoomState((prev) => ({ ...prev, active_source_name: fileName }));
  };

  // Host clears active source
  const handleClearSource = () => {
    setRoadmap([]);
    setCourseTitle("");
    setCurrentExercise(1);
    setRoomState((prev) => ({ ...prev, active_source_name: "" }));
  };

  // Host kicks a specific user by ID
  const handleKickUser = async (targetUserId: string, targetName: string) => {
    if (confirm(`هل أنت متأكد من إنهاء جلسة ${targetName} وإخراجه من الغرفة؟`)) {
      await syncEngine.kickUser(targetUserId, targetName);
      addToast(`تم إخراج ${targetName} من الغرفة.`, "error");
    }
  };

  // Host quick start topic
  const handleStartCustomTopic = async (topic: string) => {
    try {
      const formData = new FormData();
      formData.append("topicText", topic);
      formData.append("studentSlot", "A");

      const res = await fetch("/api/source/process", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.roadmap && data.roadmap.length > 0) {
        await syncEngine.setRoomSource(topic, data.roadmap, data.summary);
        handleRoadmapUpdated(data.roadmap, topic);
      }
    } catch (e) {
      console.error("Failed to start custom topic:", e);
    }
  };

  // Host quick timer trigger from Admin strip
  const handleToggleTimerFromStrip = () => {
    soundService.playSignalPing();
    if (!roomState.is_running) {
      const duration = roomState.paused_remaining_seconds ?? (roomState.timer_mode === "focus" ? 3000 : 600);
      const endsAt = new Date(Date.now() + duration * 1000).toISOString();
      const updated: RoomState = {
        ...roomState,
        is_running: true,
        timer_ends_at: endsAt,
        paused_remaining_seconds: null,
      };
      setRoomState(updated);
      syncEngine.saveRoomState(updated);
    } else {
      const diff = roomState.timer_ends_at
        ? Math.max(0, Math.floor((new Date(roomState.timer_ends_at).getTime() - Date.now()) / 1000))
        : 3000;
      const updated: RoomState = {
        ...roomState,
        is_running: false,
        timer_ends_at: null,
        paused_remaining_seconds: diff,
      };
      setRoomState(updated);
      syncEngine.saveRoomState(updated);
    }
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/?invite=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl);
    soundService.playSignalPing();
    addToast("تم نسخ رابط الدعوة إلى الحافظة! 🔗", "info");
  };

  return (
    <div className="w-full min-h-screen bg-silver-fog text-midnight-ink p-3 sm:p-5 lg:p-6 flex flex-col lg:flex-row gap-5 items-stretch justify-center relative font-arabic">
      {/* Toast Notifications Container (Bottom-Left in RTL) */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold transition-all transform animate-in slide-in-from-bottom-2 ${
              toast.type === "join"
                ? "bg-midnight-ink text-spectral-white border border-eerie-sage/40"
                : toast.type === "leave"
                ? "bg-stormy-slate text-spectral-white border border-silver-fog/30"
                : toast.type === "error"
                ? "bg-amber-900 text-amber-100 border border-amber-500/40"
                : "bg-midnight-ink/95 text-spectral-white border border-stormy-slate/30"
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-silver-fog hover:text-spectral-white rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Kicked Modal overlay if Guest was kicked by Host */}
      {isKicked && (
        <div className="fixed inset-0 bg-midnight-ink/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-spectral-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-stormy-slate/30">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-midnight-ink mb-2">
              تم إنهاء جلستك من قِبل مسؤول الغرفة
            </h2>
            <p className="text-xs text-stormy-slate mb-6 leading-relaxed">
              قام مسؤول الغرفة (أمير) بإلغاء اتصالك. يرجى التواصل معه لإعادة مشاركة الرابط.
            </p>
            <button
              onClick={() => {
                setIsKicked(false);
                handleJoin(roomCode, "A", "Amir (Host)");
              }}
              className="w-full py-3 rounded-2xl bg-midnight-ink text-spectral-white text-xs font-bold hover:bg-midnight-ink/90 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-eerie-sage" />
              <span>العودة كمسؤول الغرفة (Host)</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Sidebar (Right side in RTL) */}
      {!layout.zenMode && layout.showSidebar && (
        <Sidebar
          roomCode={roomCode}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === "settings") {
              setIsJoinModalOpen(true);
            }
          }}
          mySlot={mySlot}
          myProgress={myProgress}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onOpenMistakes={() => setIsMistakesModalOpen(true)}
        />
      )}

      {/* 2. Main Content Bento Grid */}
      <main className="flex-1 flex flex-col gap-4 w-full min-w-0 max-w-7xl">
        {/* Top Header Bar */}
        <Header
          roomCode={roomCode}
          courseTitle={courseTitle}
          mySlot={mySlot}
          studentName={studentName}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          layout={layout}
          onUpdateLayout={handleUpdateLayout}
          onToggleZenMode={handleToggleZenMode}
          miniTimerText={miniTimerText}
          isTimerRunning={isTimerRunning}
        />

        {/* Host Exclusive Admin Control Strip */}
        {mySlot === "A" && !layout.zenMode && (
          <div className="bg-midnight-ink text-spectral-white rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md border border-stormy-slate/30">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-eerie-sage" />
              <span className="text-xs font-bold font-arabic">لوحة الإدارة والتحكم السريع (أمير 👑)</span>
              <span className="text-[10px] text-silver-fog font-medium">| التحكم في الكورس، المؤقت، والزملاء</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-eerie-sage text-midnight-ink font-bold text-xs hover:bg-eerie-sage/90 transition-all shadow-xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>+ رفع / تغيير الكورس</span>
              </button>
              <button
                type="button"
                onClick={handleToggleTimerFromStrip}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-spectral-white text-xs font-bold transition-all"
              >
                {roomState.is_running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{roomState.is_running ? "إيقاف المؤقت" : "تشغيل المؤقت"}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-spectral-white text-xs font-bold transition-all"
              >
                <Share2 className="w-3.5 h-3.5 text-eerie-sage" />
                <span>نسخ رابط الدعوة</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Bento Row: Pomodoro + Roadmap + Mastery + Live Roster */}
        {!layout.zenMode && (layout.showPomodoro || layout.showStatsRow) && (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Hero Dark Pomodoro Card */}
            {layout.showPomodoro && (
              <PomodoroHeroCard
                roomState={roomState}
                setRoomState={(newState) => {
                  setRoomState(newState);
                  if (typeof newState === "function") {
                    const updated = newState(roomState);
                    syncEngine.saveRoomState(updated);
                  } else {
                    syncEngine.saveRoomState(newState);
                  }
                }}
                isHost={mySlot === "A"}
                onTimeUpdate={(time, running) => {
                  setMiniTimerText(time);
                  setIsTimerRunning(running);
                }}
              />
            )}

            {/* Card 2: Sequential Roadmap Card */}
            {layout.showStatsRow && (
              <RoadmapCard
                roadmap={roadmap}
                currentExercise={currentExercise}
                setCurrentExercise={setCurrentExercise}
                myProgress={myProgress}
                isHost={mySlot === "A"}
                onOpenUpload={mySlot === "A" ? () => setIsUploadModalOpen(true) : undefined}
              />
            )}

            {/* Card 3: Partner & Lifeline Card */}
            {layout.showStatsRow && (
              <PartnerLifelineCard
                myProgress={myProgress}
                partnerProgress={partnerProgress}
                onOpenLifeline={() => setIsLifelineModalOpen(true)}
              />
            )}

            {/* Card 4: Unified Live Roster */}
            {layout.showStatsRow && (
              <LiveRosterCard
                participants={participants}
                myUserId={myUserId}
                mySlot={mySlot}
                roomCode={roomCode}
                onKickUser={mySlot === "A" ? handleKickUser : undefined}
              />
            )}
          </section>
        )}

        {/* Main Workspace Area (Split Bento or 100% Full Width in Zen Mode) */}
        <section className="flex flex-col lg:flex-row gap-4 items-stretch flex-1 min-h-0">
          {/* Primary Workspace Panel */}
          <WorkspacePanel
            roomCode={roomCode}
            currentExercise={currentExercise}
            roadmap={roadmap}
            mySlot={mySlot}
            myProgress={myProgress}
            setMyProgress={setMyProgress}
            sourceTitle={courseTitle}
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onStartCustomTopic={handleStartCustomTopic}
          />

          {/* Right Compact Panel: Break Lounge / Quick Signals */}
          {!layout.zenMode && layout.showBreakLounge && (
            <BreakLoungePanel
              roomCode={roomCode}
              timerMode={roomState.timer_mode}
              mySlot={mySlot}
              studentName={studentName}
              myProgress={myProgress}
              partnerProgress={partnerProgress}
              onOpenLifeline={() => setIsLifelineModalOpen(true)}
            />
          )}
        </section>
      </main>

      {/* Modals & Dialogs */}
      <GuestLoginModal
        isOpen={isGuestLoginOpen}
        roomCode={roomCode}
        activeCourseTitle={courseTitle}
        onJoin={handleGuestJoin}
      />

      <RoomJoinModal
        isOpen={isJoinModalOpen}
        onJoin={handleJoin}
        onClose={() => setIsJoinModalOpen(false)}
      />

      <SourceUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        mySlot={mySlot}
        courseTitle={courseTitle}
        roadmap={roadmap}
        onRoadmapUpdated={handleRoadmapUpdated}
        onClearSource={handleClearSource}
      />

      <MistakeBankModal
        isOpen={isMistakesModalOpen}
        onClose={() => setIsMistakesModalOpen(false)}
        myProgress={myProgress}
        partnerProgress={partnerProgress}
      />

      <LifelineModal
        isOpen={isLifelineModalOpen}
        onClose={() => setIsLifelineModalOpen(false)}
        roomCode={roomCode}
        mySlot={mySlot}
        studentName={studentName}
        stageNumber={myProgress.current_stage}
        exerciseIndex={currentExercise}
        sourceTitle={courseTitle}
        partnerPassedStage={
          partnerProgress.current_exercise > myProgress.current_exercise ||
          (partnerProgress.current_exercise === myProgress.current_exercise &&
            partnerProgress.current_stage > myProgress.current_stage)
        }
      />
    </div>
  );
}
