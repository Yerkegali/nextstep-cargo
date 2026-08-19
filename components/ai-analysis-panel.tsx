import { useState } from "react";
import { Icon } from "@/components/icons";
import { parseAnalysisResponse } from "@/lib/ai/validation";
import type { AIAnalysisApiSuccess, AIAnalysisRequest, AIAnalysisResponse } from "@/lib/ai/types";

type AnalysisState = { analysis: AIAnalysisResponse; generatedAt: string } | null;

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
        const message = payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object" && "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : "AI-анализ временно недоступен. Повторите попытку позже.";
        throw new Error(message);
      }
      if (!payload || typeof payload !== "object" || !("analysis" in payload) || !("generatedAt" in payload) || typeof payload.generatedAt !== "string") throw new Error("AI-сервис вернул некорректный ответ. Повторите попытку.");
      const analysis = parseAnalysisResponse(payload.analysis);
      if (!analysis) throw new Error("AI-сервис вернул некорректный ответ. Повторите попытку.");
      const success: AIAnalysisApiSuccess = { analysis, generatedAt: payload.generatedAt };
      setResult(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI-анализ временно недоступен. Повторите попытку позже.");
    } finally { setLoading(false); }
  }

  return <div className={`ai-analysis ${result ? "has-result" : ""}`}><div className="ai-analysis-action"><div><span className="ai-mark"><Icon name="spark" className="size-5"/></span><p><strong>{heading}</strong><small>Интерпретация готовых расчётов, без изменения данных</small></p></div><button type="button" className="ai-button" onClick={runAnalysis} disabled={loading}>{loading ? <><span className="button-spinner" aria-hidden="true"/> Анализируем…</> : <><Icon name="spark" className="size-4"/> {result ? "Обновить анализ" : buttonLabel}</>}</button></div>{loading && !result && <div className="ai-loading" role="status"><span className="spinner" aria-hidden="true"/><span>AI-аналитик изучает текущие структурированные данные…</span></div>}{error && <div className="ai-error" role="status"><span>{error}</span><button type="button" onClick={runAnalysis}>Повторить</button></div>}{result && <article className="ai-result"><div className="ai-result-head"><div><p className="eyebrow">AI-рекомендация</p><h3>{result.analysis.title}</h3></div><span>На основе данных на {new Date(result.generatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div><p className="ai-summary">{result.analysis.summary}</p><ul>{result.analysis.insights.map((insight, index) => <li key={`${index}-${insight}`}><Icon name="check" className="size-4"/><span>{insight}</span></li>)}</ul>{result.analysis.recommendation && <div className="ai-recommendation"><strong>Рекомендация</strong><p>{result.analysis.recommendation}</p></div>}{result.analysis.disclaimer && <p className="ai-disclaimer">{result.analysis.disclaimer}</p>}</article>}</div>;
}
