import { NextRequest, NextResponse } from "next/server";

// ─── Google Gemini — sole AI provider ────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL_FLASH = "gemini-2.5-flash-lite"; // Cheapest available on this key
const MODEL_PRO   = "gemini-2.5-pro";        // Suite only
const MAX_TOKENS_FREE  = 2048; // Keep costs low for free/standard users
const MAX_TOKENS_SUITE = 4096; // Suite users get longer responses

export const maxDuration = 60;

// ─── Action system prompts (Suite-only actions marked) ──────────────────────

const ACTION_PROMPTS: Record<string, { system: string; temperature: number; suiteOnly: boolean }> = {
  chat: {
    system: "",
    temperature: 0.7,
    suiteOnly: false,
  },
  summarize: {
    system: "You are a summarization assistant. Provide a clear, concise summary of the given text. Use bullet points for key takeaways. Be thorough but brief.",
    temperature: 0.3,
    suiteOnly: false,
  },
  improve_writing: {
    system: "You are an expert writing editor. Improve the given text for clarity, flow, grammar, and conciseness. Preserve the original meaning and tone. Return ONLY the improved text without explanations.",
    temperature: 0.4,
    suiteOnly: false,
  },
  translate: {
    system: "You are a professional translator. Translate the given text to the requested target language. Preserve formatting, tone, and meaning. Return ONLY the translation.",
    temperature: 0.2,
    suiteOnly: true,
  },
  generate_tasks: {
    system: "You are a project planning assistant. Based on the given context (document, description, or goal), generate a structured list of actionable tasks. Format each task as a JSON array of objects with 'title', 'description', 'priority' (high/medium/low), and 'status' (todo). Return valid JSON only.",
    temperature: 0.5,
    suiteOnly: true,
  },
  analyze_document: {
    system: "You are a document analyst. Analyze the given document content and provide: 1) A brief summary, 2) Key themes and topics, 3) Sentiment/tone analysis, 4) Actionable insights or recommendations. Be structured and thorough.",
    temperature: 0.3,
    suiteOnly: true,
  },
  generate_document: {
    system: "You are a professional document writer. Generate a well-structured document based on the user's prompt. Use proper headings, paragraphs, and formatting (Markdown). Produce complete, polished content ready to use.",
    temperature: 0.6,
    suiteOnly: true,
  },
  brainstorm: {
    system: "You are a creative brainstorming partner. Generate diverse, creative ideas based on the user's topic or challenge. Provide at least 8-10 ideas, organized by category or theme. Be creative and think outside the box.",
    temperature: 0.9,
    suiteOnly: true,
  },
  code_review: {
    system: "You are a senior code reviewer. Review the given code for: 1) Bugs and potential issues, 2) Performance concerns, 3) Best practices, 4) Security considerations. Provide specific, actionable feedback.",
    temperature: 0.3,
    suiteOnly: true,
  },
  explain: {
    system: "You are a patient, clear teacher. Explain the given concept, code, or text in simple terms. Use examples and analogies. Adapt your explanation level to the user's apparent expertise.",
    temperature: 0.5,
    suiteOnly: true,
  },
  generate_chart: {
    system: `You are a data visualization assistant. Based on the user's request, generate chart configuration as valid JSON. The JSON MUST follow this exact schema:
{
  "type": "bar" | "line" | "pie" | "area",
  "title": "Chart title",
  "data": [
    { "label": "Category A", "value": 42 },
    { "label": "Category B", "value": 65 }
  ],
  "showGrid": true,
  "showLegend": false,
  "accentColor": "#f76c5e"
}
Choose the chart type that best fits the data. Generate realistic, relevant data points. Return ONLY the JSON object, no markdown fences, no explanation.`,
    temperature: 0.5,
    suiteOnly: false,
  },
  fix_grammar: {
    system: "You are a grammar and spelling expert. Fix all grammar, spelling, and punctuation errors in the given text. Preserve the original meaning, style, and formatting. Return ONLY the corrected text without explanations.",
    temperature: 0.2,
    suiteOnly: false,
  },
  make_shorter: {
    system: "You are a concise writing expert. Shorten the given text while preserving its key meaning and important details. Remove redundancy, simplify sentences, and make it more concise. Return ONLY the shortened text.",
    temperature: 0.3,
    suiteOnly: false,
  },
  make_longer: {
    system: "You are a writing expansion expert. Expand the given text with more detail, examples, and depth while maintaining the original tone and style. Return ONLY the expanded text.",
    temperature: 0.6,
    suiteOnly: false,
  },
  change_tone: {
    system: "You are a tone adjustment expert. Rewrite the given text in the tone specified by the user (e.g., formal, casual, professional, friendly, academic). Preserve the original meaning. Return ONLY the rewritten text.",
    temperature: 0.5,
    suiteOnly: false,
  },
};

// ─── Gemini helpers ──────────────────────────────────────────────────────────

function geminiRole(role: string): string {
  if (role === "developer" || role === "system") return "user";
  if (role === "assistant") return "model";
  return "user";
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function callGemini(
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
  model: string = MODEL_FLASH,
) {
  let systemInstruction: string | undefined;
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === "developer" || msg.role === "system") {
      systemInstruction = (systemInstruction ?? "") + msg.content + "\n";
      continue;
    }
    const role = geminiRole(msg.role);
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts.push({ text: msg.content });
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  if (contents.length > 0 && contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
  }

  if (contents.length > 0 && contents[contents.length - 1].role === "model") {
    contents.push({ role: "user", parts: [{ text: "Continue" }] });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

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
    console.error(`[Gemini API] Error: ${response.status}`, errText);
    let errBody: any = {};
    try { errBody = JSON.parse(errText); } catch {}
    if (response.status === 429) {
      // Extract retry delay if present
      const retryDelay = errBody?.error?.details?.find?.((d: any) => d["@type"]?.includes("RetryInfo"))?.retryDelay ?? "30s";
      throw new Error(`rate_limit:${retryDelay}`);
    }
    const detail = errBody?.error?.message ?? "";
    throw new Error(detail || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from model.";

  // Extract token usage from response metadata if available
  const usageMetadata = data?.usageMetadata;
  const inputTokens = usageMetadata?.promptTokenCount ?? estimateTokens(JSON.stringify(contents));
  const outputTokens = usageMetadata?.candidatesTokenCount ?? estimateTokens(text);

  return { text, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "No AI API key configured. Set GEMINI_API_KEY." },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const {
      messages,
      temperature,
      action = "chat",
      plan = "free",
      model: requestedModel,
    } = body;
    const max_tokens = plan === "suite" ? MAX_TOKENS_SUITE : MAX_TOKENS_FREE;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 },
      );
    }

    // Resolve action config
    const actionConfig = ACTION_PROMPTS[action] ?? ACTION_PROMPTS.chat;

    // Gate suite-only actions
    if (actionConfig.suiteOnly && plan !== "suite") {
      return NextResponse.json(
        { error: "suite_required", message: "This AI feature requires A2E Suite." },
        { status: 403 },
      );
    }

    // Determine model — suite users can request Pro, everyone else gets Flash
    const model = (plan === "suite" && requestedModel === MODEL_PRO) ? MODEL_PRO : MODEL_FLASH;

    // Prepend action system prompt if present
    const finalMessages = actionConfig.system
      ? [{ role: "system", content: actionConfig.system }, ...messages]
      : messages;

    const effectiveTemp = temperature ?? actionConfig.temperature;

    const result = await callGemini(finalMessages, effectiveTemp, max_tokens, model);

    return NextResponse.json({
      content: result.text,
      usage: {
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        total_tokens: result.totalTokens,
      },
      model,
      action,
    });
  } catch (err: any) {
    console.error("[Gemini AI] Exception:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
