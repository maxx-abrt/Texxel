import { NextRequest, NextResponse } from "next/server";

const AIML_API_URL = "https://api.aimlapi.com/v1/chat/completions";
const AIML_API_KEY = process.env.AIML_API_KEY ?? "";
const MODEL = "google/gemma-3-12b-it";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!AIML_API_KEY) {
    return NextResponse.json(
      { error: "AIML_API_KEY not configured" },
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

    const response = await fetch(AIML_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIML_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[AI API] Error:", response.status, errText);
      return NextResponse.json(
        { error: `AI API error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content ?? "No response from model.";

    return NextResponse.json({ content });
  } catch (err: any) {
    console.error("[AI API] Exception:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
