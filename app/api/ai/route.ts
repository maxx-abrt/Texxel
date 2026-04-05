import { NextRequest, NextResponse } from "next/server";

// ─── Provider config ─────────────────────────────────────────────────────────
// Primary: Google Gemini (generous free tier — 15 RPM / 1M TPD)
// Fallback: AIML API (if Gemini key not set)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const AIML_API_KEY = process.env.AIML_API_KEY ?? "";

const GEMINI_MODEL = "gemini-2.0-flash";
const AIML_MODEL = "google/gemma-3-12b-it";

export const maxDuration = 60;

// ─── Gemini provider ─────────────────────────────────────────────────────────

function geminiRole(role: string): string {
  if (role === "developer" || role === "system") return "user";
  if (role === "assistant") return "model";
  return "user";
}

async function callGemini(
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
) {
  // Gemini expects system instruction separately
  let systemInstruction: string | undefined;
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === "developer" || msg.role === "system") {
      systemInstruction = (systemInstruction ?? "") + msg.content + "\n";
      continue;
    }
    const role = geminiRole(msg.role);
    // Gemini requires strictly alternating user/model turns — merge consecutive same-role
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts.push({ text: msg.content });
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Ensure first content is from "user" (Gemini requirement)
  if (contents.length > 0 && contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
  }

  // Ensure we don't end on a "model" turn (Gemini requirement)
  if (contents.length > 0 && contents[contents.length - 1].role === "model") {
    contents.push({ role: "user", parts: [{ text: "Continue" }] });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body: any = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.trim() }] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[Gemini API] Error:", response.status, errText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from model."
  );
}

// ─── AIML fallback provider ─────────────────────────────────────────────────

async function callAiml(
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
) {
  const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIML_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AIML_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[AIML API] Error:", response.status, errText);
    throw new Error(`AIML API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "No response from model.";
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY && !AIML_API_KEY) {
    return NextResponse.json(
      { error: "No AI API key configured. Set GEMINI_API_KEY or AIML_API_KEY." },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const { messages, temperature = 0.7, max_tokens = 4096 } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 },
      );
    }

    let content: string;

    // Try Gemini first (free tier is very generous), fallback to AIML
    if (GEMINI_API_KEY) {
      try {
        content = await callGemini(messages, temperature, max_tokens);
      } catch (geminiErr: any) {
        console.warn("[AI] Gemini failed, trying AIML fallback:", geminiErr.message);
        if (AIML_API_KEY) {
          content = await callAiml(messages, temperature, max_tokens);
        } else {
          throw geminiErr;
        }
      }
    } else {
      content = await callAiml(messages, temperature, max_tokens);
    }

    return NextResponse.json({ content });
  } catch (err: any) {
    console.error("[AI API] Exception:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
