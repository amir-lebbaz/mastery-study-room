"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, RotateCw, X, Trash2, CheckCircle2, Lock } from "lucide-react";
import { StudentSlot, RoadmapExercise } from "@/types";
import { soundService } from "@/lib/audio";
import { syncEngine } from "@/lib/supabase";

interface SourceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mySlot: StudentSlot;
  courseTitle: string;
  roadmap: RoadmapExercise[];
  onRoadmapUpdated: (roadmap: RoadmapExercise[], fileName: string) => void;
  onClearSource: () => void;
}

export const SourceUploadModal: React.FC<SourceUploadModalProps> = ({
  isOpen,
  onClose,
  mySlot,
  courseTitle,
  roadmap,
  onRoadmapUpdated,
  onClearSource,
}) => {
  const isHost = mySlot === "A";
  const [file, setFile] = useState<File | null>(null);
  const [manualTopic, setManualTopic] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUploadOrProcess = async () => {
    if (!file && !manualTopic.trim()) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      }
      if (manualTopic.trim()) {
        formData.append("topicText", manualTopic.trim());
      }
      formData.append("studentSlot", "A");

      const res = await fetch("/api/source/process", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.error) {
        setUploadError(data.error);
        return;
      }

      if (data.roadmap && data.roadmap.length > 0) {
        const finalTitle = data.fileName || file?.name || manualTopic.trim();
        // Save to Supabase Cloud & sync with partner
        await syncEngine.setRoomSource(finalTitle, data.roadmap, data.summary);

        soundService.playMasteryFanfare();
        onRoadmapUpdated(data.roadmap as RoadmapExercise[], finalTitle);
        onClose();
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("حدث خطأ أثناء معالجة واستخراج مسار الملف.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteActiveSource = async () => {
    await syncEngine.clearRoomSources();
    onClearSource();
    soundService.playSignalPing();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-midnight-ink/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-spectral-white text-midnight-ink rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stormy-slate/20 transition-all max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stormy-slate/15 shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-midnight-ink" />
            <div>
              <h2 className="text-base font-black text-midnight-ink leading-tight">
                إدارة ملفات الكورس (Course Sources)
              </h2>
              <span className="text-[11px] text-stormy-slate font-medium">
                {isHost ? "صلاحية حصرية لك كصاحب الغرفة 👑" : "ملفات الكورس المعتمدة"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stormy-slate hover:text-midnight-ink hover:bg-silver-fog/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* If Guest/Partner (Slot B): Read-only view */}
        {!isHost ? (
          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-silver-fog/40 flex items-center justify-center mb-3 text-stormy-slate">
              <Lock className="w-6 h-6 text-midnight-ink" />
            </div>
            <h3 className="text-sm font-bold text-midnight-ink mb-1">
              صلاحية الرفع والإدارة مخصصة لصاحب الغرفة فقط
            </h3>
            <p className="text-xs text-stormy-slate max-w-sm mb-4 leading-relaxed">
              يقوم صاحب الغرفة (Host) برفع ملفات وسلاسل التمارين أو تحديد موضوع الدرس، وتظهر لك التمارين وتتزامن معك تلقائياً.
            </p>

            {courseTitle ? (
              <div className="w-full p-4 bg-white rounded-2xl border border-stormy-slate/15 text-right">
                <span className="text-[11px] font-bold text-eerie-sage uppercase tracking-wider block mb-1">
                  المصدر النشط حالياً:
                </span>
                <span className="text-sm font-black text-midnight-ink block truncate">
                  📄 {courseTitle}
                </span>
                <span className="text-xs text-stormy-slate block mt-1">
                  يتضمن {roadmap.length} تمارين تسلسلية معتمدة
                </span>
              </div>
            ) : (
              <div className="p-4 bg-white/70 rounded-2xl border border-stormy-slate/15 text-xs text-stormy-slate">
                بانتظار قيام صاحب الغرفة برفع ملف الدرس الأول...
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-5 px-6 py-2 rounded-xl bg-midnight-ink text-spectral-white text-xs font-bold hover:bg-midnight-ink/90"
            >
              حسناً، فهمت
            </button>
          </div>
        ) : (
          /* Host (Slot A) Controls: Upload, Topic Input & Delete */
          <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
            {/* Active Source Banner */}
            {courseTitle ? (
              <div className="p-3.5 bg-white rounded-2xl border border-eerie-sage/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate max-w-[280px]">
                  <CheckCircle2 className="w-5 h-5 text-eerie-sage shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-bold text-midnight-ink truncate">
                      {courseTitle}
                    </span>
                    <span className="text-[10px] text-stormy-slate">
                      {roadmap.length} تمارين • نشط ومتزامن مع زميلك
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteActiveSource}
                  className="p-2 rounded-xl text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 text-xs font-bold flex items-center gap-1 transition-all"
                  title="حذف هذا الملف وإلغاء تنشيطه للجميع"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">حذف الملف</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-silver-fog/30 rounded-2xl border border-stormy-slate/15 text-center text-xs text-stormy-slate">
                لا يوجد أي ملف كورس نشط حالياً. ارفع ملفك للبدء فوراً:
              </div>
            )}

            {uploadError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {uploadError}
              </div>
            )}

            {/* Dropzone for PDF / Photo */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stormy-slate/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-midnight-ink bg-white/70 transition-all text-center"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,image/*"
                className="hidden"
              />
              <FileText className="w-8 h-8 text-eerie-sage" />
              <span className="text-xs font-bold text-midnight-ink">
                {file ? file.name : "اضغط لرفع ملف PDF أو صورة تمرين/امتحان"}
              </span>
              <span className="text-[10px] text-stormy-slate">يدعم PDF, PNG, JPG</span>
            </div>

            {file && (
              <div className="p-2.5 bg-white rounded-xl border border-stormy-slate/15 flex items-center justify-between text-xs">
                <span className="truncate max-w-[260px] font-semibold">{file.name}</span>
                <span className="text-stormy-slate font-mono">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            {/* Manual Topic Option */}
            <div className="pt-2 border-t border-stormy-slate/15">
              <label className="text-[11px] font-bold text-midnight-ink block mb-1">
                أو اكتب عنوان المادة / المسألة يدوياً دون ملف:
              </label>
              <input
                type="text"
                value={manualTopic}
                onChange={(e) => setManualTopic(e.target.value)}
                placeholder="مثال: الاحتمالات والإحصاء، الحركة الدائرية لنيوتن..."
                className="w-full bg-white border border-stormy-slate/25 rounded-xl px-3.5 py-2.5 text-xs text-midnight-ink outline-hidden focus:border-midnight-ink"
                dir="rtl"
              />
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-stormy-slate/20 text-xs font-bold text-stormy-slate hover:text-midnight-ink"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handleUploadOrProcess}
                disabled={(!file && !manualTopic.trim()) || isUploading}
                className="flex-1 py-2.5 rounded-xl bg-midnight-ink text-spectral-white text-xs font-bold hover:bg-midnight-ink/90 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isUploading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-eerie-sage" />
                    <span>جاري الاستخراج بالذكاء الاصطناعي...</span>
                  </>
                ) : (
                  <span>اعتماد الملف وتحديث الغرفة</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
