import { useState } from "react";
import { Icon } from "@/components/icons";
import { buildLocalAnalysisFallback } from "@/lib/ai/fallback";
import { parseAnalysisResponse } from "@/lib/ai/validation";
import type { AIAnalysisApiSuccess, AIAnalysisRequest, AIAnalysisResponse } from "@/lib/ai/types";

type AnalysisState = { analysis: AIAnalysisResponse; generatedAt: string; source: "gemini" | "fallback" } | null;
type FallbackReason = "timeout" | "provider_http_error" | "invalid_response" | "validation_failure";
const genericError = "AI-сервис временно недоступен. Показана системная интерпретация готовых расчётов.";

class AnalysisRequestError extends Error {
  constructor(message: string, public readonly reason: FallbackReason) { super(message); }
}

function readProviderError(payload: unknown): { code?: string; message?: string } {
  if (!payload || typeof payload !== "object" || !("error" in payload) || !payload.error || typeof payload.error !== "object") return {};
  return {
    code: "code" in payload.error && typeof payload.error.code === "string" ? payload.error.code : undefined,
    message: "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : undefined,
  };
}

export function AIAnalysisPanel({ request, buttonLabel, heading }: { request: AIAnalysisRequest; buttonLabel: string; heading: string }) {
  const [result, setResult] = useState<AnalysisState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    if (loading) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const providerError = readProviderError(payload);
        const reason: FallbackReason = providerError.code === "timeout" ? "timeout" : providerError.code === "malformed" ? "invalid_response" : "provider_http_error";
        throw new AnalysisRequestError(providerError.message ?? "AI-анализ временно недоступен. Повторите попытку позже.", reason);
      }
      if (!payload || typeof payload !== "object" || !("analysis" in payload) || !("generatedAt" in payload) || typeof payload.generatedAt !== "string") throw new AnalysisRequestError("AI-сервис вернул некорректный ответ. Повторите попытку.", "invalid_response");
      const analysis = parseAnalysisResponse(payload.analysis);
      if (!analysis) throw new AnalysisRequestError("AI-сервис вернул некорректный ответ. Повторите попытку.", "validation_failure");
      const success: AIAnalysisApiSuccess = { analysis, generatedAt: payload.generatedAt };
      setResult({ ...success, source: "gemini" });
    } catch (caught) {
      setError(caught instanceof AnalysisRequestError ? caught.message : genericError);
      setResult({ analysis: buildLocalAnalysisFallback(request), generatedAt: new Date().toISOString(), source: "fallback" });
      if (process.env.NODE_ENV !== "production" && request.type === "regional_flow_analysis") {
        console.warn("[AI] dispatcher fallback activated", {
          reason: caught instanceof AnalysisRequestError ? caught.reason : "provider_http_error",
        });
      }
    } finally { setLoading(false); }
  }

  return <div className={`ai-analysis ${result ? "has-result" : ""}`}><div className="ai-analysis-action"><div><span className="ai-mark"><Icon name="spark" className="size-5"/></span><p><strong>{heading}</strong><small>Интерпретация готовых расчётов, без изменения данных</small></p></div><button type="button" className="ai-button" onClick={runAnalysis} disabled={loading}>{loading ? <><span className="button-spinner" aria-hidden="true"/> Анализируем…</> : <><Icon name="spark" className="size-4"/> {result?.source === "gemini" ? "Обновить анализ" : result ? "Повторить AI-анализ" : buttonLabel}</>}</button></div>{loading && !result && <div className="ai-loading" role="status"><span className="spinner" aria-hidden="true"/><span>AI-аналитик изучает текущие структурированные данные…</span></div>}{error && <div className="ai-error" role="status"><span>{error}</span><button type="button" onClick={runAnalysis}>Повторить Gemini</button></div>}{result && <article className="ai-result"><div className="ai-result-head"><div><p className="eyebrow">{result.source === "gemini" ? "AI-рекомендация" : "Системная интерпретация"}</p><h3>{result.analysis.title}</h3></div><span>На основе данных на {new Date(result.generatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div><p className="ai-summary">{result.analysis.summary}</p><ul>{result.analysis.insights.map((insight, index) => <li key={`${index}-${insight}`}><Icon name="check" className="size-4"/><span>{insight}</span></li>)}</ul>{result.analysis.recommendation && <div className="ai-recommendation"><strong>Рекомендация</strong><p>{result.analysis.recommendation}</p></div>}{result.analysis.disclaimer && <p className="ai-disclaimer">{result.analysis.disclaimer}</p>}</article>}</div>;
}
