import "server-only";
import { buildAnalysisPrompt, getSystemInstruction } from "@/lib/ai/prompts";
import { parseAnalysisResponse } from "@/lib/ai/validation";
import type { AIAnalysisRequest, AIAnalysisResponse } from "@/lib/ai/types";

const GEMINI_MODEL = "gemini-3.6-flash";
const PROVIDER_TIMEOUT_MS = 15_000;

export class AIProviderError extends Error {
  constructor(public readonly code: "not_configured" | "rate_limited" | "unavailable" | "timeout" | "malformed") { super(code); }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown; thought?: boolean }> };
    finishReason?: string;
    finishMessage?: string;
  }>;
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
}

interface GeminiErrorResponse {
  error?: { code?: number; message?: string; status?: string };
}

async function readProviderError(response: Response): Promise<GeminiErrorResponse["error"]> {
  try {
    const data = await response.json() as GeminiErrorResponse;
    return data.error;
  } catch {
    return undefined;
  }
}

function logProviderFailure(response: Response, error: GeminiErrorResponse["error"]) {
  if (process.env.NODE_ENV === "production") return;
  const providerMessage = typeof error?.message === "string"
    ? error.message.replace(/\s+/g, " ").trim().slice(0, 500)
    : "No provider error message";
  console.error("[Gemini] generateContent failed", {
    model: GEMINI_MODEL,
    httpStatus: response.status,
    providerCode: error?.status ?? error?.code ?? "unknown",
    providerMessage,
  });
}

type ResponseDiagnostic = {
  httpStatus: number;
  finishReason?: string;
  candidateCount: number;
  partCount: number;
  textLength: number;
};

function logResponseFailure(stage: string, diagnostic: ResponseDiagnostic, reason?: string) {
  if (process.env.NODE_ENV === "production") return;
  console.error("[Gemini] response handling failed", {
    model: GEMINI_MODEL,
    stage,
    ...diagnostic,
    ...(reason ? { reason } : {}),
  });
}

function normalizeJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function describeValidationFailure(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "root_not_object";
  const data = value as Record<string, unknown>;
  if (typeof data.title !== "string") return "title_not_string";
  if (typeof data.summary !== "string") return "summary_not_string";
  if (!Array.isArray(data.insights)) return "insights_not_array";
  if (!data.insights.every((item) => typeof item === "string")) return "insight_not_string";
  if (data.recommendation !== undefined && typeof data.recommendation !== "string") return "recommendation_not_string";
  if (data.disclaimer !== undefined && typeof data.disclaimer !== "string") return "disclaimer_not_string";
  return "field_empty_or_outside_length_limits";
}

export async function analyzeLogistics(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIProviderError("not_configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      cache: "no-store",
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: getSystemInstruction(request.type) }] },
        contents: [{ role: "user", parts: [{ text: buildAnalysisPrompt(request) }] }],
        generationConfig: {
          maxOutputTokens: 2_000,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            required: ["title", "summary", "insights"],
            properties: {
              title: { type: "STRING" },
              summary: { type: "STRING" },
              insights: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
              recommendation: { type: "STRING" },
              disclaimer: { type: "STRING" },
            },
          },
        },
      }),
    });
    if (!response.ok) {
      const providerError = await readProviderError(response);
      logProviderFailure(response, providerError);
      if (response.status === 429) throw new AIProviderError("rate_limited");
      throw new AIProviderError("unavailable");
    }
    let providerData: GeminiResponse;
    try {
      providerData = await response.json() as GeminiResponse;
    } catch {
      logResponseFailure("provider_json_parse", {
        httpStatus: response.status,
        candidateCount: 0,
        partCount: 0,
        textLength: 0,
      });
      throw new AIProviderError("malformed");
    }

    const candidates = Array.isArray(providerData.candidates) ? providerData.candidates : [];
    const candidate = candidates[0];
    const finishReason = candidate?.finishReason;
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const textParts = parts.flatMap((part) => typeof part.text === "string" && part.thought !== true ? [part.text] : []);
    const text = textParts.join("").trim();
    const diagnostic: ResponseDiagnostic = {
      httpStatus: response.status,
      finishReason,
      candidateCount: candidates.length,
      partCount: parts.length,
      textLength: text.length,
    };

    if (providerData.promptFeedback?.blockReason) {
      logResponseFailure("blocked", diagnostic, providerData.promptFeedback.blockReason);
      throw new AIProviderError("malformed");
    }
    if (!candidate) {
      logResponseFailure("missing_candidates", diagnostic);
      throw new AIProviderError("malformed");
    }
    if (finishReason === "MAX_TOKENS") {
      logResponseFailure("max_tokens", diagnostic);
      throw new AIProviderError("malformed");
    }
    if (!candidate.content) {
      logResponseFailure("missing_content", diagnostic, finishReason);
      throw new AIProviderError("malformed");
    }
    if (!parts.length) {
      logResponseFailure("missing_parts", diagnostic, finishReason);
      throw new AIProviderError("malformed");
    }
    if (!text) {
      logResponseFailure("missing_text", diagnostic, finishReason);
      throw new AIProviderError("malformed");
    }

    const normalizedText = normalizeJsonText(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalizedText);
    } catch {
      logResponseFailure("analysis_json_parse", diagnostic);
      throw new AIProviderError("malformed");
    }
    const analysis = parseAnalysisResponse(parsed);
    if (!analysis) {
      logResponseFailure("response_validation", diagnostic, describeValidationFailure(parsed));
      throw new AIProviderError("malformed");
    }
    return analysis;
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new AIProviderError("timeout");
    throw new AIProviderError("unavailable");
  } finally { clearTimeout(timeout); }
}
