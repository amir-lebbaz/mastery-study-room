import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

// Exact Verbatim Prompt from c:\Users\amir\OneDrive\Desktop\NOT.txt
const MASTER_PEDAGOGICAL_PROMPT = `
# Role & Core Directive
You are an interactive Mastery Learning Academic Tutor. Base your entire teaching, rules, and exercises strictly on the uploaded sources in this notebook. Do not extrapolate outside the provided curriculum concepts. Cite only sources you are certain of from the uploaded files; if a future rule is drawn from standard domain extensions of the source, label it clearly.

Your objective is to guide the student through every exercise or section in the uploaded source in exact sequential order (Exercise 1 -> Exercise 2 -> Exercise 3, etc.). Never skip ahead or dump multiple exercises at once. Process strictly ONE exercise/concept at a time through the two phases below.

---

# Critical Language & Communication Rules (HARD LOCKS)
1. **Explanations, Breakdowns & Examples:** MUST be written in clear, natural **Arabic**, while keeping essential technical and academic terms in **English** (paired with their source equivalent if the source is in French or another language) so the student masters the English terminology.
2. **Questions & Prompts Posed to the Student:** MUST ALWAYS be written in clear **Simple English** (regardless of the source's original language), immediately followed underneath by a brief **Arabic explanation** clarifying what is required in the question.
3. **Student Responses:** Accept the student's answers in **ANY language** (Arabic, English, French, or mixed code/pseudocode) and evaluate purely on conceptual and technical accuracy.

---

# Phase 1: Deep Onboarding (For the Current Exercise/Concept)
Before testing the student on the current item in the sequence, present a structured explanation in Arabic (with key English terms) covering these 6 points in order:
1. **المطلوب (The Objective):** Explain clearly what the current exercise or section is asking for and its core goal.
2. **شرح الدرس والمفهوم (Core Lesson Explanation):** Break down the underlying lesson and theoretical mechanics needed to solve it.
3. **القواعد المستعملة والمستقبلية (Active & Future Rules):**
   - **القواعد المستعملة الآن (Used Rules):** Exact rules, formulas, or syntax required for this specific exercise.
   - **قواعد إضافية للمستقبل (Unused / Future Rules):** Related rules from the topic/source not needed in this exact question, but likely to appear in harder variations or future exams.
4. **مثال تمهيدي بسيط (Simple Warm-up Example):** A minimal, stripped-down example illustrating the core rule in action.
5. **مثال يحاكي السلسلة (Source-Level Example):** A complete worked example matching the exact difficulty and structure of the current exercise in the source, showing step-by-step how and why it works (including Markdown tables and LaTeX math formulas).
6. **مثال تشبيهي من الواقع (Real-Life Analogy):** A vivid, relatable real-world analogy that makes the abstract concept intuitive and unforgettable.

*STOP after Phase 1 and immediately launch Stage 1 of Phase 2.*

---

# Phase 2: The 3-Stage Mastery Gauntlet
Test the student sequentially across 3 stages. Present ONLY ONE stage at a time and wait for the student's reply.

- **Stage 1 (Easy / Foundational):** A simplified exercise similar to the current source exercise, stripped of complex edge cases to verify basic mechanics.
- **Stage 2 (Medium / Parallel):** A standard exercise matching the structure and difficulty of the source exercise with different values/scenarios.
- **Stage 3 (Mastery & Extension):** The actual exercise from the uploaded source PLUS a calculated twist, edge case, or analytical extension designed to measure deep comprehension.

### Mandatory Question Format (Use for Every Question):
**[Stage X / 3]**
**Question (English):** [Write the full question/problem clearly in English]
**المطلوب باختصار:** [شرح بسيط ومباشر بالعربية يوضح المطلوب من التمرين بدقة]

---

# Evaluation, Gating & Remediation Engine (Strict Execution)
Whenever the student submits an answer, evaluate it and apply these exact rules:

1. **Grading & The 9/10 Mastery Gate:**
   - Score the response out of **10** based on correctness, logic, and completeness.
   - **Pass Condition (>= 9/10):** Praise specific strengths, correct any minor 1-point slip, and advance to the next Stage. If Stage 3 is passed with >= 9/10, congratulate the student and immediately start **Phase 1 for the NEXT exercise** in the source sequence.
   - **Hold Condition (less than 9/10):** You are FORBIDDEN from advancing to the next stage. State clearly that mastery (9/10) is required to unlock the next stage.

2. **Targeted Remediation (When Score is less than 9/10, Failures 1 to 2):**
   - **تحديد نقاط القوة والضعف (Diagnostic):** Explicitly list the student's **Strengths (نقاط القوة)** and **Weaknesses (نقاط الضعف)** based on their attempt.
   - **معالجة نقاط الضعف (Targeted Fix):** Re-explain ONLY the weak points clearly in Arabic with English key terms.
   - **اختبار مخصص (Adaptive Re-Test):** Generate a new test at the current stage that tests their **strengths lightly** (for retention) and tests their **weaknesses heavily** (to build mastery). Follow the Mandatory Question Format.

3. **3-Strike Reset Protocol (When Strike Count reaches 3):**
   - Pause the testing loop immediately.
   - **إعادة الشرح المبسط (Ultra-Simplified Breakdown):** Re-explain the concept from scratch in a much simpler, highly detailed step-by-step manner in Arabic.
   - **مثال تطبيقي خفيف ومحلول (Guided Micro-Example):** Provide a lightweight, fully solved example of the exact problem type they struggled with, explaining **HOW** each step is solved and **WHY** each decision is made.
   - Resume the current stage with a fresh question once the reset explanation is delivered.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action = "evaluate", // "onboard" | "evaluate" | "stage_question" | "chat"
      exerciseIndex = 1,
      exerciseTitle = "",
      stage = 1,
      userPrompt = "",
      imageBase64 = null,
      history = [],
      currentStrikes = 0,
      apiKey: clientApiKey = "",
      sourceTitle = "",
      sourceId = "",
      extractedText = "",
    } = body;

    const primaryApiKey = (process.env.GEMINI_API_KEY || clientApiKey || "").trim();
    const fallbackApiKey = (process.env.GEMINI_API_KEY_FALLBACK || "").trim();

    if (!primaryApiKey || primaryApiKey.length < 10) {
      return NextResponse.json(
        {
          error: "MISSING_API_KEY",
          message: "يرجى إدخال مفتاح Google Gemini API Key الخاص بك لتفعيل الذكاء الاصطناعي الحقيقي المباشر (gemini-2.5-flash).",
        },
        { status: 401 }
      );
    }

    const cacheKey = sourceId || sourceTitle || "default_curriculum";

    // 1. Zero-Cost Phase 1 Onboarding Cache Check (Saves ~50% Gemini Tokens)
    if (action === "onboard") {
      try {
        const { data: cached } = await supabase
          .from("exercise_onboarding_cache")
          .select("content_markdown")
          .eq("source_id", cacheKey)
          .eq("exercise_index", exerciseIndex)
          .maybeSingle();

        if (cached?.content_markdown) {
          return NextResponse.json({
            content: cached.content_markdown,
            metadata: {
              score: 9,
              passed: true,
              current_stage: 1,
              next_stage: 1,
              strike_count: 0,
              cached: true,
            },
            isRealAI: true,
          });
        }
      } catch (cacheErr) {
        console.error("Cache read error:", cacheErr);
      }
    }

    // 2. Strict Per-Exercise Context Scoping (Prevents TPM token bloat)
    const contents = [];
    const scopedHistory = Array.isArray(history) ? history.slice(-4) : [];

    for (const h of scopedHistory) {
      contents.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      });
    }

    const currentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    let finalUserPrompt = userPrompt;

    const activeContext = sourceTitle
      ? `[Context: Active Course Source is "${sourceTitle}". Extracted Reference: "${extractedText || sourceTitle}"]`
      : `[Context: General Topic]`;
    const exTitleStr = exerciseTitle ? `("${exerciseTitle}")` : "";

    if (action === "onboard") {
      finalUserPrompt = `${activeContext}
Generate Phase 1 Deep Onboarding for Exercise ${exerciseIndex} ${exTitleStr}.
Follow the 6 Points in exact order in natural Arabic with essential technical terms in English.
Include accurate LaTeX math ($...$ and $$...$$) and GFM Markdown tables if applicable for formulas or worked examples.
Immediately at the end of Phase 1, launch Stage 1 of Phase 2 with the mandatory question format:
**[Stage 1 / 3]**
**Question (English):** [clear Simple English]
**المطلوب باختصار:** [شرح عربي دقيق وموجز]`;
    } else if (action === "stage_question") {
      finalUserPrompt = `${activeContext}
Present the challenge question for Stage ${stage} / 3 of Exercise ${exerciseIndex} ${exTitleStr}.
Follow the mandatory format strictly:
**[Stage ${stage} / 3]**
**Question (English):** [clear Simple English]
**المطلوب باختصار:** [شرح عربي دقيق وموجز]`;
    } else if (action === "chat") {
      finalUserPrompt = `${activeContext}
Student Question regarding Exercise ${exerciseIndex} (Stage ${stage} / 3):
"${userPrompt}"
Answer helpfully and concisely in natural Arabic with English technical terms. Do not give away complete exam solutions.`;
    } else {
      // Evaluation turn:
      const strikeWarning =
        currentStrikes === 2
          ? `CRITICAL NOTICE: The student has accumulated 2 strikes. If this answer scores < 9/10, this triggers STRIKE 3. You MUST execute the 3-Strike Reset Protocol: pause testing, deliver an ultra-simplified breakdown in Arabic, provide a guided micro-example explaining HOW and WHY each step is solved, and present a fresh Stage ${stage} question.`
          : `Current authoritative strike count: ${currentStrikes}/3.`;

      finalUserPrompt = `${activeContext}
Exercise ${exerciseIndex} ${exTitleStr}, Current Stage: ${stage} / 3.
${strikeWarning}

Student Message or Submission:
"${userPrompt}"

MANDATORY INTENT CLASSIFICATION & PEDAGOGICAL INSTRUCTIONS:
1. Intent Classification:
   - "answer_submission": The student is submitting an actual attempt, mathematical proof, computation, solution, or code answering the Stage ${stage} problem.
   - "clarification_question": The student is asking a question about the concept, asking for a hint, asking to explain something differently, or asking about the question itself.
   - "greeting_or_offtopic": The student wrote a greeting (e.g., "أهلاً", "مرحباً", "hello", "hi"), casual chit-chat, or off-topic message.

2. Behavior by Intent:
   - IF intent is "clarification_question":
     * DO NOT grade or evaluate this as an exam answer!
     * score MUST be 0.
     * passed MUST be false.
     * weaknesses MUST be [].
     * strengths MUST be [].
     * In feedback_markdown: Answer the student's question directly, clearly, and helpfully in natural Arabic with English technical terms. Provide an intuitive hint or explanation without revealing the complete final answer. Then warmly encourage them to solve the Stage ${stage} question.
   - IF intent is "greeting_or_offtopic":
     * DO NOT grade!
     * score MUST be 0.
     * passed MUST be false.
     * weaknesses MUST be [].
     * strengths MUST be [].
     * In feedback_markdown: Greet the student warmly in Arabic and invite them to begin or continue tackling the Stage ${stage} question when ready.
   - IF intent is "answer_submission":
     * Grade the solution strictly out of 10 based on conceptual and technical accuracy using the 9/10 Mastery Gate.
     * If score >= 9: Set passed=true. Praise specific strengths. Advance to the next stage challenge.
     * If score < 9: Set passed=false. Diagnose weaknesses and strengths. Re-explain weak points in Arabic with English terms. Provide an adaptive re-test.
     * If this is Strike 3: Deliver the complete 3-Strike Reset Protocol (ultra-simplified breakdown + guided micro-example).`;
    }

    currentParts.push({ text: finalUserPrompt });

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      currentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      });
    }

    contents.push({
      role: "user",
      parts: currentParts,
    });

    // Structured Outputs for evaluation turns
    const isEvaluation = action === "evaluate";

    const generationConfig: Record<string, unknown> = {
      temperature: isEvaluation ? 0.2 : 0.25,
      maxOutputTokens: 8192,
    };

    if (isEvaluation) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = {
        type: "OBJECT",
        properties: {
          intent: {
            type: "STRING",
            enum: ["answer_submission", "clarification_question", "greeting_or_offtopic"],
            description:
              "Classify user intent: 'answer_submission' ONLY for actual test solutions. 'clarification_question' for questions or hints. 'greeting_or_offtopic' for greetings or casual messages.",
          },
          feedback_markdown: {
            type: "STRING",
            description:
              "Pedagogical response in Arabic with English technical terms. Explains, clarifies, or diagnoses based on the intent.",
          },
          score: {
            type: "INTEGER",
            description:
              "Integer score out of 10 (0-10) ONLY when intent is answer_submission. Must be 0 for questions or greetings.",
          },
          passed: {
            type: "BOOLEAN",
            description:
              "True ONLY if intent is answer_submission and score >= 9. Must be false for questions or greetings.",
          },
          weaknesses: {
            type: "ARRAY",
            items: { type: "STRING" },
            description:
              "List of diagnosed weaknesses ONLY for graded answer_submission. Empty array [] for other intents.",
          },
          strengths: {
            type: "ARRAY",
            items: { type: "STRING" },
            description:
              "List of diagnosed strengths ONLY for graded answer_submission. Empty array [] for other intents.",
          },
        },
        required: ["intent", "feedback_markdown", "score", "passed", "weaknesses", "strengths"],
      };
    }

    const payloadBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: MASTER_PEDAGOGICAL_PROMPT }],
      },
      contents,
      generationConfig,
    });

    // 3. Graceful 429 Rate-Limit Handling + Fallback API Key
    let activeKey = primaryApiKey;
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadBody,
      }
    );

    // If 429 Rate Limit occurs and fallback key exists, retry once with fallback key
    if (response.status === 429 && fallbackApiKey && fallbackApiKey !== primaryApiKey) {
      console.warn("Primary Gemini key hit 429 rate limit. Retrying with GEMINI_API_KEY_FALLBACK...");
      activeKey = fallbackApiKey;
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadBody,
        }
      );
    }

    if (response.status === 429) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT",
          retryAfterSeconds: 15,
          message: "تم الوصول للحد المؤقت للـ API — انتظر 15 ثانية ثم أعد المحاولة",
        },
        { status: 429 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return NextResponse.json(
        {
          error: "GEMINI_API_ERROR",
          message: `خطأ من Google Gemini API (${response.status}): تأكد من صلاحية المفتاح وحصتك في Google AI Studio.`,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const candidateParts = candidate?.content?.parts || [];
    const rawText = candidateParts
      .map((p: { text?: string }) => p.text || "")
      .join("") || "لم يتم استلام رد من النموذج.";

    if (isEvaluation) {
      try {
        const parsed = JSON.parse(rawText);
        const intent: "answer_submission" | "clarification_question" | "greeting_or_offtopic" =
          parsed.intent === "answer_submission" ||
          parsed.intent === "clarification_question" ||
          parsed.intent === "greeting_or_offtopic"
            ? parsed.intent
            : parsed.is_clarifying_question
            ? "clarification_question"
            : "answer_submission";

        const isAnswer = intent === "answer_submission";
        const rawScore = typeof parsed.score === "number" ? parsed.score : 0;
        const score = isAnswer ? rawScore : null;
        const passed = isAnswer && Boolean(parsed.passed && rawScore >= 9);

        // Server-Side Authoritative Strike Calculation (Gemini NEVER tracks strikes!)
        // Strikes and progression ONLY change on 'answer_submission'!
        let authoritativeStrikes = currentStrikes || 0;
        let resetTriggered = false;

        if (isAnswer) {
          if (passed) {
            authoritativeStrikes = 0;
          } else {
            authoritativeStrikes += 1;
            // 3-Strike Protocol: Trigger strictly at strikes === 3 (not > 3)
            if (authoritativeStrikes === 3) {
              resetTriggered = true;
              authoritativeStrikes = 0; // Reset in DB immediately after remediation is delivered
            }
          }
        }

        const metadata = {
          intent,
          score,
          passed,
          current_stage: stage,
          next_stage: passed ? (stage >= 3 ? 1 : stage + 1) : stage,
          strike_count: authoritativeStrikes,
          reset_triggered: resetTriggered,
          weaknesses: isAnswer ? parsed.weaknesses || [] : [],
          strengths: isAnswer ? parsed.strengths || [] : [],
          lifeline_eligible: authoritativeStrikes >= 2,
        };

        return NextResponse.json({
          content: parsed.feedback_markdown || "تمت معالجة الرسالة بنجاح.",
          metadata,
          isRealAI: true,
        });
      } catch (parseErr) {
        console.error("Failed to parse evaluation structured output:", parseErr, rawText);
        return NextResponse.json({
          content: rawText,
          metadata: {
            intent: "clarification_question",
            score: null,
            passed: false,
            current_stage: stage,
            next_stage: stage,
            strike_count: currentStrikes || 0,
            weaknesses: [],
            strengths: [],
            lifeline_eligible: (currentStrikes || 0) >= 2,
          },
          isRealAI: true,
        });
      }
    }

    // For non-evaluation (onboard, stage_question, chat)
    const cleanContent = rawText.replace(/```json\s*[\s\S]*?\s*```/, "").trim();

    // Cache Phase 1 Onboarding output in Supabase
    if (action === "onboard" && cleanContent.length > 50) {
      try {
        await supabase.from("exercise_onboarding_cache").upsert(
          {
            source_id: cacheKey,
            exercise_index: exerciseIndex,
            content_markdown: cleanContent,
          },
          { onConflict: "source_id,exercise_index" }
        );
      } catch (cacheSaveErr) {
        console.error("Cache save error:", cacheSaveErr);
      }
    }

    return NextResponse.json({
      content: cleanContent,
      metadata: {
        score: 9,
        passed: true,
        current_stage: stage,
        next_stage: stage,
        strike_count: currentStrikes,
      },
      isRealAI: true,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Tutor API error:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
