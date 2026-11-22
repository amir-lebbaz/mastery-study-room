export type StudentSlot = "A" | "B";

export type UserRole = "host" | "guest";

export type TimerMode = "focus" | "break";

export interface RoadmapExercise {
  id: number;
  title: string;
  topic: string;
  description: string;
  isUnlocked: boolean;
  isCompleted: boolean;
  totalStages: number;
}

export interface StudentSource {
  id: string;
  file_name: string;
  student_slot?: StudentSlot;
  uploaded_at: string;
  roadmap: RoadmapExercise[];
  summary?: string;
  extracted_text?: string;
}

export interface RoomParticipant {
  user_id: string;
  display_name: string;
  role: UserRole;
  current_exercise: number;
  current_stage: number;
  is_online: boolean;
  joined_at?: string;
  last_seen_at?: string;
}

export interface StudentProgress {
  id: string;
  room_id: string;
  user_id?: string;
  role?: UserRole;
  student_slot: StudentSlot;
  student_name: string;
  active_source?: StudentSource | null;
  current_exercise: number;
  current_stage: number;
  strikes: number;
  last_score: number;
  passed_stages: number[];
  mistakes: Array<{
    exercise: number;
    stage: number;
    weakness: string;
    timestamp: string;
  }>;
  is_online: boolean;
  last_seen_at: string;
}

export interface MistakeRecord {
  id: string;
  room_id: string;
  user_id?: string;
  student_slot?: StudentSlot;
  exercise_index: number;
  stage?: number;
  weakness_summary: string;
  resolved: boolean;
  created_at: string;
}

export type TutorIntent = "answer_submission" | "clarification_question" | "greeting_or_offtopic";

export interface TutorMessage {
  id: string;
  room_id: string;
  user_id?: string;
  student_slot: StudentSlot | "shared";
  exercise_index: number;
  phase: 1 | 2;
  role: "user" | "assistant" | "system";
  content: string;
  image_url?: string;
  score?: number | null;
  metadata?: {
    intent?: TutorIntent;
    score?: number | null;
    passed?: boolean;
    current_stage?: number;
    next_stage?: number;
    strike_count?: number;
    weaknesses?: string[];
    strengths?: string[];
    lifeline_eligible?: boolean;
    feedback_ar?: string;
    cached?: boolean;
  };
  created_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id?: string;
  role?: UserRole;
  sender_slot: StudentSlot;
  sender_name: string;
  type: "signal" | "chat" | "lifeline";
  content: string;
  created_at: string;
}

export interface RoomState {
  id: string;
  code: string;
  timer_mode: TimerMode;
  timer_seconds_remaining?: number;
  timer_ends_at: string | null;
  paused_remaining_seconds: number | null;
  is_running: boolean;
  active_source_name?: string;
}

export interface LayoutVisibility {
  showSidebar: boolean;
  showPomodoro: boolean;
  showStatsRow: boolean;
  showBreakLounge: boolean;
  zenMode: boolean;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: "join" | "leave" | "info" | "error";
  timestamp: number;
}
