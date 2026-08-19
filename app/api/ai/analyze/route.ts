import { analyzeLogistics, AIProviderError } from "@/lib/ai/provider";
import { parseAnalysisRequest } from "@/lib/ai/validation";

const MAX_REQUEST_BYTES = 20_000;

const errorMessages: Record<AIProviderError["code"], string> = {
  not_configured: "AI-анализ недоступен в текущей конфигурации.",
  rate_limited: "Лимит AI-сервиса временно исчерпан. Повторите попытку позже.",
  unavailable: "AI-сервис временно недоступен. Основные функции продолжают работать.",
  timeout: "AI-сервис не успел ответить. Повторите попытку.",
  malformed: "AI-сервис вернул некорректный ответ. Повторите попытку.",
};

export async function POST(request: Request) {
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_REQUEST_BYTES) return Response.json({ error: { code: "invalid_request", message: "Запрос слишком большой." } }, { status: 413 });
  let rawBody: string;
  try { rawBody = await request.text(); } catch { return Response.json({ error: { code: "invalid_request", message: "Не удалось прочитать запрос." } }, { status: 400 }); }
  if (!rawBody || rawBody.length > MAX_REQUEST_BYTES) return Response.json({ error: { code: "invalid_request", message: "Некорректный размер запроса." } }, { status: 400 });
  let input: unknown;
  try { input = JSON.parse(rawBody); } catch { return Response.json({ error: { code: "invalid_request", message: "Некорректный формат запроса." } }, { status: 400 }); }
  const analysisRequest = parseAnalysisRequest(input);
  if (!analysisRequest) return Response.json({ error: { code: "invalid_request", message: "Данные для анализа не прошли проверку." } }, { status: 400 });

  try {
    const analysis = await analyzeLogistics(analysisRequest);
    return Response.json({ analysis, generatedAt: new Date().toISOString() });
  } catch (error) {
    const providerError = error instanceof AIProviderError ? error : new AIProviderError("unavailable");
    const status = providerError.code === "not_configured" ? 503 : providerError.code === "rate_limited" ? 429 : 502;
    return Response.json({ error: { code: providerError.code, message: errorMessages[providerError.code] } }, { status });
  }
}

