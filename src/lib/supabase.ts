import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  StudentProgress,
  RoomMessage,
  TutorMessage,
  RoomState,
  RoadmapExercise,
  MistakeRecord,
  RoomParticipant,
  UserRole,
} from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mtuhuzmyhbemdfsbyhpf.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dWh1em15aGJlbWRmc2J5aHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MjIxNDAsImV4cCI6MjA5MjQ5ODE0MH0.Pip_Y_FfjJvnOHxnAMNUlHMBLkGefVxH2dVMsXaIQ08";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface LiveRoomData {
  dbRoomId: string;
  code: string;
  timer_mode: "focus" | "break";
  timer_seconds_remaining?: number;
  timer_ends_at: string | null;
  paused_remaining_seconds: number | null;
  is_running: boolean;
  active_source_title: string;
  active_roadmap: RoadmapExercise[];
  partner_kicked?: boolean;
}

// Resilient Live Cloud & Multi-Device Sync Engine
class ProductionSyncEngine {
  private currentDbRoomId: string | null = null;
  private currentRoomCode: string = "8921";
  private currentSlot: "A" | "B" = "A";
  private currentUserId: string = "user-host";
  private currentUserName: string = "Amir";
  private currentRole: UserRole = "host";
  private realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;

  public subscribe(eventType: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  private notify(eventType: string, payload: unknown) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error("Listener error:", e);
        }
      });
    }
  }

  // Initialize room in Supabase (creates if not exists, retrieves real UUID)
  public async initRoom(
    code: string,
    mySlot: "A" | "B",
    myName: string,
    myUserId?: string,
    myRole: UserRole = mySlot === "A" ? "host" : "guest",
    currentExercise: number = 1,
    currentStage: number = 1
  ): Promise<LiveRoomData> {
    this.currentRoomCode = code;
    this.currentSlot = mySlot;
    this.currentUserId = myUserId || (mySlot === "A" ? "host-amir" : `guest-${Date.now()}`);
    this.currentUserName = myName;
    this.currentRole = myRole;

    // 1. Fetch or create room in Supabase
    let dbRoom: {
      id: string;
      code: string;
      timer_mode: "focus" | "break";
      timer_seconds_remaining?: number;
      timer_ends_at?: string | null;
      paused_remaining_seconds?: number | null;
      is_running: boolean;
      active_source_id?: string;
    } | null = null;

    try {
      const { data: existing, error: selectErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (selectErr) {
        console.error("Error fetching room:", selectErr);
      }

      if (existing) {
        dbRoom = existing;
      } else {
        const { data: created, error: insertErr } = await supabase
          .from("rooms")
          .insert({
            code,
            timer_mode: "focus",
            timer_ends_at: null,
            paused_remaining_seconds: 3000,
            is_running: false,
          })
          .select("*")
          .single();

        if (insertErr) {
          console.error("Error creating room:", insertErr);
        } else {
          dbRoom = created;
        }
      }
    } catch (e) {
      console.error("Room init error:", e);
    }

    if (!dbRoom) {
      // Fallback
      dbRoom = {
        id: "local-fallback",
        code,
        timer_mode: "focus",
        timer_ends_at: null,
        paused_remaining_seconds: 3000,
        is_running: false,
      };
    }

    this.currentDbRoomId = dbRoom.id;

    // 2. Fetch Active Source & Roadmap if any
    let activeTitle = "";
    let activeRoadmap: RoadmapExercise[] = [];

    if (this.currentDbRoomId && this.currentDbRoomId !== "local-fallback") {
      try {
        const { data: sources } = await supabase
          .from("sources")
          .select("*")
          .eq("room_id", this.currentDbRoomId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (sources && sources.length > 0) {
          activeTitle = sources[0].file_name;
          activeRoadmap = (sources[0].roadmap_json as RoadmapExercise[]) || [];
        }
      } catch (err) {
        console.error("Error fetching sources:", err);
      }
    }

    // 3. Register Student profile record once on join (Zero heartbeat writes!)
    if (this.currentDbRoomId && this.currentDbRoomId !== "local-fallback") {
      try {
        await supabase.from("student_progress").upsert(
          {
            room_id: this.currentDbRoomId,
            student_slot: mySlot,
            user_id: this.currentUserId,
            role: myRole,
            student_name: myName,
            is_online: true,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "room_id,student_slot" }
        );
      } catch (e) {
        console.error("Profile upsert error:", e);
      }
    }

    // 4. Setup Dynamic In-Memory Realtime Presence & Channels (Multi-user 3+)
    this.setupRealtimeChannel(code, myName, currentExercise, currentStage);

    // 5. Gentle Read-Only Polling Fallback (15s, ZERO DB writes!)
    this.startReadOnlySyncLoop();

    return {
      dbRoomId: dbRoom.id,
      code: dbRoom.code,
      timer_mode: dbRoom.timer_mode || "focus",
      timer_seconds_remaining: dbRoom.paused_remaining_seconds ?? dbRoom.timer_seconds_remaining ?? 3000,
      timer_ends_at: dbRoom.timer_ends_at || null,
      paused_remaining_seconds: dbRoom.paused_remaining_seconds ?? 3000,
      is_running: Boolean(dbRoom.is_running),
      active_source_title: activeTitle,
      active_roadmap: activeRoadmap,
    };
  }

  // Setup Supabase Realtime channel with DYNAMIC MULTI-USER PRESENCE (Zero DB writes!)
  private setupRealtimeChannel(code: string, myName: string, currentExercise: number = 1, currentStage: number = 1) {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = supabase.channel(`mastery_room_${code}`, {
      config: {
        presence: { key: this.currentUserId },
        broadcast: { self: false },
      },
    });

    this.realtimeChannel
      .on("presence", { event: "sync" }, () => {
        const state = this.realtimeChannel?.presenceState() || {};
        const participants: RoomParticipant[] = [];

        Object.values(state).forEach((presences: unknown) => {
          if (Array.isArray(presences)) {
            presences.forEach((p: Record<string, unknown>) => {
              if (p && p.user_id) {
                participants.push({
                  user_id: String(p.user_id),
                  display_name: String(p.display_name || p.name || "Student"),
                  role: (p.role as UserRole) || "guest",
                  current_exercise: typeof p.current_exercise === "number" ? p.current_exercise : 1,
                  current_stage: typeof p.current_stage === "number" ? p.current_stage : 1,
                  is_online: true,
                  joined_at: String(p.joined_at || p.online_at || new Date().toISOString()),
                });
              }
            });
          }
        });

        this.notify("participants_sync", participants);

        // Backward compatibility for 2-slot presence indicator
        const hasOtherUser = participants.some((p) => p.user_id !== this.currentUserId);
        this.notify("partner_presence_updated", { is_online: hasOtherUser });
      })
      .on("presence", { event: "join" }, ({ newPresences }: { newPresences: unknown[] }) => {
        if (Array.isArray(newPresences)) {
          newPresences.forEach((p: unknown) => {
            const raw = p as Record<string, unknown>;
            if (raw && raw.user_id && raw.user_id !== this.currentUserId) {
              this.notify("participant_joined", {
                user_id: String(raw.user_id),
                display_name: String(raw.display_name || raw.name || "طالب جديد"),
                role: (raw.role as UserRole) || "guest",
              });
            }
          });
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }: { leftPresences: unknown[] }) => {
        if (Array.isArray(leftPresences)) {
          leftPresences.forEach((p: unknown) => {
            const raw = p as Record<string, unknown>;
            if (raw && raw.user_id && raw.user_id !== this.currentUserId) {
              this.notify("participant_left", {
                user_id: String(raw.user_id),
                display_name: String(raw.display_name || raw.name || "طالب"),
                role: (raw.role as UserRole) || "guest",
              });
            }
          });
        }
      })
      .on("broadcast", { event: "timer_update" }, ({ payload }) => {
        this.notify("room_state_updated", payload);
      })
      .on("broadcast", { event: "source_update" }, ({ payload }) => {
        this.notify("source_updated", payload);
      })
      .on("broadcast", { event: "student_progress" }, ({ payload }) => {
        this.notify("student_progress_updated", payload);
      })
      .on("broadcast", { event: "room_message" }, ({ payload }) => {
        this.notify("room_message_added", payload);
      })
      .on("broadcast", { event: "partner_kicked" }, ({ payload }) => {
        this.notify("partner_kicked", payload);
      })
      .on("broadcast", { event: "user_kicked" }, ({ payload }) => {
        this.notify("user_kicked", payload);
      })
      .on("broadcast", { event: "mistake_bank_updated" }, ({ payload }) => {
        this.notify("mistake_bank_updated", payload);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.realtimeChannel?.track({
            user_id: this.currentUserId,
            slot: this.currentSlot,
            name: myName,
            display_name: myName,
            role: this.currentRole,
            current_exercise: currentExercise,
            current_stage: currentStage,
            online_at: new Date().toISOString(),
            joined_at: new Date().toISOString(),
          });
        }
      });
  }

  // Update my live presence status dynamically (e.g. when moving to next stage)
  public async updateMyPresence(exercise: number, stage: number, name?: string) {
    if (!this.realtimeChannel) return;
    try {
      await this.realtimeChannel.track({
        user_id: this.currentUserId,
        slot: this.currentSlot,
        name: name || this.currentUserName,
        display_name: name || this.currentUserName,
        role: this.currentRole,
        current_exercise: exercise,
        current_stage: stage,
        online_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Update presence error:", e);
    }
  }

  // Host kicks a specific user
  public async kickUser(targetUserId: string, targetName: string) {
    if (!this.currentDbRoomId) return;

    try {
      await supabase.from("room_messages").insert({
        room_id: this.currentDbRoomId,
        sender_slot: "A",
        sender_name: "System",
        type: "signal",
        content: `تم إنهاء جلسة ${targetName} من قِبل صاحب الغرفة.`,
      });

      this.realtimeChannel?.send({
        type: "broadcast",
        event: "user_kicked",
        payload: { targetUserId },
      });
    } catch (e) {
      console.error("Kick user error:", e);
    }
  }

  // Phase 1 Onboarding Explanation Cache Helpers (Zero-Cost Gemini Optimization)
  public async fetchOnboardingCache(sourceId: string, exerciseIndex: number): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("exercise_onboarding_cache")
        .select("content_markdown")
        .eq("source_id", sourceId)
        .eq("exercise_index", exerciseIndex)
        .maybeSingle();

      if (!error && data?.content_markdown) {
        return data.content_markdown;
      }
    } catch (e) {
      console.error("Cache read error:", e);
    }
    return null;
  }

  public async saveOnboardingCache(sourceId: string, exerciseIndex: number, content: string) {
    try {
      await supabase.from("exercise_onboarding_cache").upsert(
        {
          source_id: sourceId,
          exercise_index: exerciseIndex,
          content_markdown: content,
        },
        { onConflict: "source_id,exercise_index" }
      );
    } catch (e) {
      console.error("Cache save error:", e);
    }
  }

  // Gentle read-only sync loop (every 15 seconds, purely reads DB, 0 DB WRITES)
  private startReadOnlySyncLoop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(async () => {
      if (!this.currentDbRoomId || this.currentDbRoomId === "local-fallback") return;

      try {
        // Fetch Partner's latest progress strictly read-only
        const partnerSlot = this.currentSlot === "A" ? "B" : "A";
        const { data: partnerData } = await supabase
          .from("student_progress")
          .select("*")
          .eq("room_id", this.currentDbRoomId)
          .eq("student_slot", partnerSlot)
          .maybeSingle();

        if (partnerData) {
          const partnerProg: StudentProgress = {
            id: partnerData.id,
            room_id: this.currentRoomCode,
            student_slot: partnerSlot,
            student_name: partnerData.student_name,
            current_exercise: partnerData.current_exercise || 1,
            current_stage: partnerData.current_stage || 1,
            strikes: partnerData.strikes || 0,
            last_score: partnerData.last_score || 0,
            passed_stages: (partnerData.passed_stages_json as number[]) || [],
            mistakes: partnerData.mistakes_json || [],
            is_online: partnerData.is_online,
            last_seen_at: partnerData.last_seen_at,
          };
          this.notify("partner_progress_polled", partnerProg);
        }

        // Fetch latest Room timer and active source
        const { data: roomData } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", this.currentDbRoomId)
          .maybeSingle();

        if (roomData) {
          this.notify("room_state_polled", {
            id: roomData.id,
            code: roomData.code,
            timer_mode: roomData.timer_mode,
            timer_ends_at: roomData.timer_ends_at,
            paused_remaining_seconds: roomData.paused_remaining_seconds,
            is_running: roomData.is_running,
          });
        }
      } catch {
        // network silent retry
      }
    }, 15000);
  }

  // Save room state (Pomodoro) to Supabase (ZERO DB writes during running tick!)
  public async saveRoomState(state: RoomState) {
    if (!this.currentDbRoomId) return;

    try {
      await supabase
        .from("rooms")
        .update({
          timer_mode: state.timer_mode,
          timer_ends_at: state.timer_ends_at,
          paused_remaining_seconds: state.paused_remaining_seconds,
          is_running: state.is_running,
        })
        .eq("id", this.currentDbRoomId);

      this.realtimeChannel?.send({
        type: "broadcast",
        event: "timer_update",
        payload: state,
      });
    } catch (e) {
      console.error("Save room state error:", e);
    }
  }

  // Save student progress to Supabase
  public async saveProgress(progress: StudentProgress) {
    if (!this.currentDbRoomId) return;

    try {
      await supabase.from("student_progress").upsert(
        {
          room_id: this.currentDbRoomId,
          student_slot: progress.student_slot,
          student_name: progress.student_name,
          current_exercise: progress.current_exercise,
          current_stage: progress.current_stage,
          strikes: progress.strikes,
          last_score: progress.last_score,
          passed_stages_json: progress.passed_stages || [],
          mistakes_json: progress.mistakes || [],
          is_online: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "room_id,student_slot" }
      );

      this.realtimeChannel?.send({
        type: "broadcast",
        event: "student_progress",
        payload: progress,
      });
    } catch (e) {
      console.error("Save progress error:", e);
    }
  }

  // Host uploads or sets new active source
  public async setRoomSource(fileName: string, roadmap: RoadmapExercise[], summary?: string, extractedText?: string) {
    if (!this.currentDbRoomId) return;

    try {
      // 1. Insert into sources table with extracted_text
      const { data: newSource } = await supabase
        .from("sources")
        .insert({
          room_id: this.currentDbRoomId,
          file_name: fileName,
          roadmap_json: roadmap,
          storage_path: summary || "",
          extracted_text: extractedText || "",
        })
        .select("*")
        .single();

      if (newSource) {
        // 2. Update room active source pointer
        await supabase
          .from("rooms")
          .update({
            active_source_id: newSource.id,
          })
          .eq("id", this.currentDbRoomId);

        // 3. Broadcast to partner device immediately
        this.realtimeChannel?.send({
          type: "broadcast",
          event: "source_update",
          payload: {
            fileName,
            roadmap,
            summary,
            extractedText,
          },
        });
      }
    } catch (e) {
      console.error("Set room source error:", e);
    }
  }

  // Mistake Bank Database Operations
  public async fetchMistakes(): Promise<MistakeRecord[]> {
    if (!this.currentDbRoomId) return [];
    try {
      const { data, error } = await supabase
        .from("mistake_bank")
        .select("*")
        .eq("room_id", this.currentDbRoomId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data.map((d) => ({
          id: d.id,
          room_id: this.currentRoomCode,
          student_slot: d.student_slot,
          exercise_index: d.exercise_index,
          stage: d.stage || 1,
          weakness_summary: d.weakness_summary,
          resolved: Boolean(d.resolved),
          created_at: d.created_at,
        }));
      }
    } catch (e) {
      console.error("Fetch mistakes error:", e);
    }
    return [];
  }

  public async addMistake(mistake: Omit<MistakeRecord, "id" | "created_at">) {
    if (!this.currentDbRoomId) return;
    try {
      const { data } = await supabase
        .from("mistake_bank")
        .insert({
          room_id: this.currentDbRoomId,
          student_slot: mistake.student_slot,
          exercise_index: mistake.exercise_index,
          stage: mistake.stage || 1,
          weakness_summary: mistake.weakness_summary,
          resolved: false,
        })
        .select("*")
        .single();

      if (data) {
        this.realtimeChannel?.send({
          type: "broadcast",
          event: "mistake_bank_updated",
          payload: data,
        });
      }
    } catch (e) {
      console.error("Add mistake error:", e);
    }
  }

  public async resolveMistake(mistakeId: string) {
    try {
      await supabase
        .from("mistake_bank")
        .update({ resolved: true })
        .eq("id", mistakeId);

      this.realtimeChannel?.send({
        type: "broadcast",
        event: "mistake_bank_updated",
        payload: { id: mistakeId, resolved: true },
      });
    } catch (e) {
      console.error("Resolve mistake error:", e);
    }
  }

  // Host clears/deletes all sources
  public async clearRoomSources() {
    if (!this.currentDbRoomId) return;

    try {
      await supabase.from("sources").delete().eq("room_id", this.currentDbRoomId);
      await supabase
        .from("rooms")
        .update({ active_source_id: null })
        .eq("id", this.currentDbRoomId);

      this.realtimeChannel?.send({
        type: "broadcast",
        event: "source_update",
        payload: {
          fileName: "",
          roadmap: [],
        },
      });
    } catch (e) {
      console.error("Clear room sources error:", e);
    }
  }

  // Host kicks/removes partner (Student B)
  public async kickPartner() {
    if (!this.currentDbRoomId) return;

    try {
      // 1. Delete student B progress from database
      await supabase
        .from("student_progress")
        .delete()
        .eq("room_id", this.currentDbRoomId)
        .eq("student_slot", "B");

      // 2. Add system message in chat
      await supabase.from("room_messages").insert({
        room_id: this.currentDbRoomId,
        sender_slot: "A",
        sender_name: "System",
        type: "signal",
        content: "تم إنهاء جلسة الزميل من قِبل صاحب الغرفة.",
      });

      // 3. Broadcast kick event so partner device immediately blocks access
      this.realtimeChannel?.send({
        type: "broadcast",
        event: "partner_kicked",
        payload: { kicked: true },
      });
    } catch (e) {
      console.error("Kick partner error:", e);
    }
  }

  // Send a room message (chat, signal, lifeline)
  public async addRoomMessage(msg: Omit<RoomMessage, "id" | "created_at">) {
    if (!this.currentDbRoomId) return;

    try {
      const { data } = await supabase
        .from("room_messages")
        .insert({
          room_id: this.currentDbRoomId,
          sender_slot: msg.sender_slot,
          sender_name: msg.sender_name,
          type: msg.type,
          content: msg.content,
        })
        .select("*")
        .single();

      if (data) {
        const fullMsg: RoomMessage = {
          id: data.id,
          room_id: this.currentRoomCode,
          sender_slot: data.sender_slot,
          sender_name: data.sender_name,
          type: data.type,
          content: data.content,
          created_at: data.created_at,
        };

        this.notify("room_message_added", fullMsg);
        this.realtimeChannel?.send({
          type: "broadcast",
          event: "room_message",
          payload: fullMsg,
        });
      }
    } catch (e) {
      console.error("Add room message error:", e);
    }
  }

  // Fetch room messages
  public async fetchRoomMessages(): Promise<RoomMessage[]> {
    if (!this.currentDbRoomId) return [];

    try {
      const { data } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", this.currentDbRoomId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (data) {
        return data.map((d) => ({
          id: d.id,
          room_id: this.currentRoomCode,
          sender_slot: d.sender_slot,
          sender_name: d.sender_name,
          type: d.type,
          content: d.content,
          created_at: d.created_at,
        }));
      }
    } catch (e) {
      console.error("Fetch room messages error:", e);
    }
    return [];
  }

  // Save Tutor message to database
  public async addTutorMessage(msg: Omit<TutorMessage, "id" | "created_at">) {
    if (!this.currentDbRoomId) return;

    try {
      await supabase.from("tutor_messages").insert({
        room_id: this.currentDbRoomId,
        student_slot: msg.student_slot,
        exercise_index: msg.exercise_index,
        phase: msg.phase,
        role: msg.role,
        content: msg.content,
        image_url: msg.image_url,
        score: msg.score,
        metadata_json: msg.metadata || {},
      });
    } catch (e) {
      console.error("Add tutor message error:", e);
    }
  }

  // Fetch Tutor conversation history
  public async fetchTutorMessages(slot: "A" | "B" | "shared", exerciseIndex: number): Promise<TutorMessage[]> {
    if (!this.currentDbRoomId) return [];

    try {
      const { data } = await supabase
        .from("tutor_messages")
        .select("*")
        .eq("room_id", this.currentDbRoomId)
        .eq("student_slot", slot)
        .eq("exercise_index", exerciseIndex)
        .order("created_at", { ascending: true });

      if (data) {
        return data.map((d) => ({
          id: d.id,
          room_id: this.currentRoomCode,
          student_slot: d.student_slot,
          exercise_index: d.exercise_index,
          phase: d.phase,
          role: d.role,
          content: d.content,
          image_url: d.image_url,
          score: d.score,
          metadata: d.metadata_json,
          created_at: d.created_at,
        }));
      }
    } catch (e) {
      console.error("Fetch tutor messages error:", e);
    }
    return [];
  }

  public cleanup() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
    }
  }
}

export const syncEngine = new ProductionSyncEngine();
export const DEFAULT_ROADMAP: RoadmapExercise[] = [];
