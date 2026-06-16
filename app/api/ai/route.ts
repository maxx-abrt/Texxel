import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Types ───────────────────────────────────────────────────────────────────
type Role = "developer" | "system" | "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
}
interface AiRequest {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  action?: string;
  plan?: "free" | "suite";
  model?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const AIML_KEY = process.env.AIML_API_KEY;
const AIML_MODEL = process.env.AIML_MODEL || "gpt-4o-mini";

// Token-economy guards: keep latest history, cap per-message size so a single
// huge document paste can't blow the budget (and cost).
const MAX_HISTORY = 16; // most recent non-system messages
const MAX_MESSAGE_CHARS = 24_000; // ~6k tokens per message ceiling
const MAX_SYSTEM_CHARS = 28_000;

function clamp(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "\n…[truncated]" : s;
}

function splitMessages(messages: ChatMessage[]) {
  const system = messages
    .filter((m) => m.role === "developer" || m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const convo = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const trimmed = convo.slice(-MAX_HISTORY).map((m) => ({
    role: m.role,
    content: clamp(m.content, MAX_MESSAGE_CHARS),
  }));
  return { system: clamp(system, MAX_SYSTEM_CHARS), convo: trimmed };
}

// ─── Gemini ──────────────────────────────────────────────────────────────────
async function callGemini(
  system: string,
  convo: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
  model: string,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const body: Record<string, unknown> = {
    contents: convo.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topP: 0.95,
      // Token economy: disable "thinking" tokens on 2.5+ flash models. This
      // cuts cost/latency materially for an assistant that emits structured
      // actions rather than long chains of reasoning.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };

  // Gemini's free tier occasionally returns 429/500/503 (overloaded). Retry a
  // couple of times with backoff so the assistant stays reliable.
  const RETRYABLE = new Set([429, 500, 502, 503, 504]);
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const cand = data?.candidates?.[0];
      const text: string =
        cand?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      const u = data?.usageMetadata ?? {};
      return {
        content: text,
        usage: {
          input_tokens: u.promptTokenCount ?? 0,
          output_tokens: u.candidatesTokenCount ?? 0,
          total_tokens: u.totalTokenCount ?? 0,
        },
        model,
      };
    }
    const errText = await res.text().catch(() => "");
    lastErr = `gemini ${res.status}: ${errText.slice(0, 200)}`;
    if (!RETRYABLE.has(res.status)) break;
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error(lastErr || "gemini request failed");
}

// ─── AIML (OpenAI-compatible) fallback ─────────────────────────────────────────
async function callAIML(
  system: string,
  convo: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
) {
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...convo,
  ];
  const res = await fetch("https://api.aimlapi.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AIML_KEY}`,
    },
    body: JSON.stringify({
      model: AIML_MODEL,
      messages,
      temperature,
      max_tokens: Math.min(maxTokens, 4096),
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`aiml ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const u = data?.usage ?? {};
  return {
    content,
    usage: {
      input_tokens: u.prompt_tokens ?? 0,
      output_tokens: u.completion_tokens ?? 0,
      total_tokens: u.total_tokens ?? 0,
    },
    model: AIML_MODEL,
  };
}

// ─── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Lightweight gate: AI lives inside the authenticated app, so require a session
  // cookie. Prevents anonymous abuse of the key without a heavy token check.
  const cookieStore = await cookies();
  const authed =
    !!cookieStore.get("wos-session")?.value || !!cookieStore.get("dev-user")?.value;
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: AiRequest;
  try {
    payload = (await req.json()) as AiRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const temperature = Math.min(Math.max(payload.temperature ?? 0.7, 0), 2);
  const maxTokens = Math.min(payload.max_tokens ?? 8192, 8192);
  const model = payload.model || GEMINI_MODEL;
  const { system, convo } = splitMessages(payload.messages);

  // Try Gemini first (free tier, primary), fall back to AIML on any failure.
  if (GEMINI_KEY) {
    try {
      const out = await callGemini(system, convo, temperature, maxTokens, model);
      if (out.content && out.content.trim().length > 0) {
        return NextResponse.json(out);
      }
      throw new Error("empty gemini response");
    } catch (e) {
      console.error("[ai] gemini failed:", (e as Error).message);
    }
  }

  if (AIML_KEY) {
    try {
      const out = await callAIML(system, convo, temperature, maxTokens);
      return NextResponse.json(out);
    } catch (e) {
      console.error("[ai] aiml failed:", (e as Error).message);
    }
  }

  return NextResponse.json(
    { error: "AI providers unavailable. Check GEMINI_API_KEY / AIML_API_KEY." },
    { status: 502 },
  );
}
