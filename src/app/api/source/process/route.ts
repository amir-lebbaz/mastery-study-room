import { NextResponse } from "next/server";
import { RoadmapExercise } from "@/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const topicText = (formData.get("topicText") as string | null) || "";
    const studentSlot = (formData.get("studentSlot") as string | null) || "A";
    const clientApiKey = (formData.get("apiKey") as string | null) || "";
    const hostPasscode = (formData.get("hostPasscode") as string | null) || "";

    // Server-side host auth check
    if (studentSlot !== "A" && hostPasscode !== "amir2026") {
      return NextResponse.json(
        { error: "غير مصرح لك بتغيير مصادر الكورس. صلاحية الرفع لمالك الغرفة (أمير) فقط." },
        { status: 403 }
      );
    }

    if (!file && !topicText.trim()) {
      return NextResponse.json(
        { error: "يرجى اختيار ملف PDF / صورة أو كتابة عنوان الدرس." },
        { status: 400 }
      );
    }

    const fileName = file ? file.name : topicText.trim();
    const primaryApiKey = (process.env.GEMINI_API_KEY || clientApiKey || "").trim();
    const fallbackApiKey = (process.env.GEMINI_API_KEY_FALLBACK || "").trim();

    // Call Real Gemini 2.5 Flash to extract roadmap from PDF, Image, or Topic
    if (primaryApiKey && primaryApiKey.length > 10) {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      const prompt = `Analyze this course syllabus, exercise sheet, or study topic carefully: "${fileName}".
Extract 3 to 5 distinct sequential exercises or conceptual topics in exact pedagogical order.
Also extract the core mathematical formulas, algorithms, or exercise statements as extracted_text.
For each exercise, provide:
1. id (integer starting at 1)
2. title ("Exercise X: [Concept Title in English/Arabic]")
3. topic (main subject domain)
4. description (1 concise sentence explaining the concept)
5. isUnlocked (true for id=1, false for others)
6. isCompleted (false)
7. totalStages (3)

Return ONLY valid JSON matching this schema:
{
  "summary": "Brief 1-sentence description of the curriculum",
  "extracted_text": "Exact or summarized text of the exercises, theorems, and rules found in the document",
  "roadmap": [
    {
      "id": 1,
      "title": "Exercise 1: [Topic Title]",
      "topic": "[Main Topic]",
      "description": "[1 sentence conceptual summary]",
      "isUnlocked": true,
      "isCompleted": false,
      "totalStages": 3
    }
  ]
}`;

      parts.push({ text: prompt });

      if (file) {
        const buffer = await file.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");
        parts.push({
          inlineData: {
            mimeType: file.type || "application/pdf",
            data: base64Data,
          },
        });
      }

      const callGemini = async (key: string) => {
        const models = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"];
        for (const model of models) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ role: "user", parts }],
                  generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json",
                  },
                }),
              }
            );
            if (res.ok || res.status === 429) {
              return res;
            }
          } catch (e) {
            console.warn(`Model ${model} request failed:`, e);
          }
        }
        return await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            }),
          }
        );
      };

      let response = await callGemini(primaryApiKey);

      if (response.status === 429 && fallbackApiKey) {
        console.warn("Primary API key rate limited on source processing, switching to GEMINI_API_KEY_FALLBACK...");
        response = await callGemini(fallbackApiKey);
      }

      if (response.status === 429) {
        return NextResponse.json(
          {
            error: "RATE_LIMIT",
            message: "تم الوصول للحد المؤقت للـ API — انتظر 15 ثانية ثم أعد المحاولة",
            retryAfterSeconds: 15,
          },
          { status: 429 }
        );
      }

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          try {
            const parsed = JSON.parse(rawText);
            const roadmap: RoadmapExercise[] = Array.isArray(parsed)
              ? parsed
              : parsed.roadmap || [];

            if (roadmap.length > 0) {
              return NextResponse.json({
                fileName,
                studentSlot,
                roadmap,
                summary: parsed.summary || "",
                extractedText: parsed.extracted_text || topicText || fileName,
                isRealAI: true,
              });
            }
          } catch (e) {
            console.error("Failed to parse Gemini roadmap JSON:", e);
          }
        }
      }
    }

    // Fallback if AI call doesn't produce JSON
    const cleanTitle = fileName.replace(/\.[^/.]+$/, "");
    const generatedRoadmap: RoadmapExercise[] = [
      {
        id: 1,
        title: `Exercise 1: ${cleanTitle} — Core Fundamentals`,
        topic: cleanTitle,
        description: "Understanding fundamental rules and foundational mechanics",
        isUnlocked: true,
        isCompleted: false,
        totalStages: 3,
      },
      {
        id: 2,
        title: `Exercise 2: ${cleanTitle} — Applied Problem Solving`,
        topic: cleanTitle,
        description: "Standard problems and analytical patterns from the source",
        isUnlocked: false,
        isCompleted: false,
        totalStages: 3,
      },
      {
        id: 3,
        title: `Exercise 3: ${cleanTitle} — Advanced Edge Cases & Mastery`,
        topic: cleanTitle,
        description: "Complex synthesis, tricky edge cases, and exam-level extension",
        isUnlocked: false,
        isCompleted: false,
        totalStages: 3,
      },
    ];

    return NextResponse.json({
      fileName,
      studentSlot,
      roadmap: generatedRoadmap,
      summary: `Roadmap automatically generated for ${cleanTitle}`,
      extractedText: topicText || cleanTitle,
      isRealAI: false,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Source process API error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة ملف الكورس", details: error?.message },
      { status: 500 }
    );
  }
}
