import type { AIAnalysisRequest, AIAnalysisResponse, SafeRouteMatchFacts } from "@/lib/ai/types";

const formatNumber = (value: number, maximumFractionDigits = 1) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits }).format(value);

function formatOrderDifference(value: number): string {
  const lastTwo = value % 100;
  const last = value % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14 ? "заявок" : last === 1 ? "заявку" : last >= 2 && last <= 4 ? "заявки" : "заявок";
  return `${formatNumber(value, 0)} ${noun}`;
}

function buildReturnRouteFallback(match: SafeRouteMatchFacts): AIAnalysisResponse {
  const route = `${match.origin} → ${match.destination}`;
  const routeDescription = match.matchType === "direct_return"
    ? `Маршрут ${route} является прямым обратным рейсом.`
    : match.matchType === "nearby_return"
      ? `Маршрут ${route} требует ${formatNumber(match.repositionKm)} км до точки погрузки и сокращает дальнейший пустой путь.`
      : `Маршрут ${route} частично возвращает автомобиль в исходном направлении.`;

  const recommendation = match.matchType === "direct_return"
    ? "Прямой обратный рейс позволяет максимально сократить порожний пробег."
    : match.matchType === "nearby_return"
      ? "Сопоставьте пользу от сокращения пустого пути с указанным пробегом до точки погрузки."
      : "Частичный обратный рейс сокращает пустой путь, но не устраняет его полностью.";

  return {
    title: "Системная интерпретация маршрута",
    summary: routeDescription,
    insights: [
      `Без обратного груза автомобиль прошёл бы ${formatNumber(match.emptyKmBefore)} км пустым.`,
      `С выбранным рейсом расчётный порожний пробег снижается до ${formatNumber(match.emptyKmAfter)} км.`,
      `Расчётная экономия составляет около ${formatNumber(match.fuelSavedLiters)} л топлива и ${formatNumber(match.estimatedSavingsKzt, 0)} ₸.`,
      `Совместимость маршрута — ${formatNumber(match.matchScore, 0)}%.`,
    ],
    recommendation,
    disclaimer: "Системная интерпретация основана только на готовых расчётах NextStep Cargo; AI-сервис временно недоступен.",
  };
}

function buildRegionalFallback(request: Extract<AIAnalysisRequest, { type: "regional_flow_analysis" }>): AIAnalysisResponse {
  const { data } = request;
  const meaningfulImbalances = data.imbalances
    .filter((item): item is typeof item & { dominantDirection: string } => item.difference >= 2 && Boolean(item.dominantDirection))
    .sort((a, b) => b.difference - a.difference || (b.aToB + b.bToA) - (a.aToB + a.bToA))
    .slice(0, 2);
  const leadingImbalance = meaningfulImbalances[0];
  const imbalanceInsights = meaningfulImbalances.map((item) =>
    `На направлении ${item.dominantDirection} на ${formatOrderDifference(item.difference)} больше, чем во встречном направлении.`
  );
  const insights = [
    `Текущие показатели: доступные заказы — ${formatNumber(data.availableOrders, 0)}, активные доставки — ${formatNumber(data.activeDeliveries, 0)}, завершённые доставки — ${formatNumber(data.deliveredOrders, 0)}.`,
    `Принятые обратные рейсы — ${formatNumber(data.acceptedReturnMatches, 0)}; сохранено ${formatNumber(data.savings.savedKm)} км, оценочно ${formatNumber(data.savings.fuelSavedLiters)} л топлива и ${formatNumber(data.savings.estimatedSavingsKzt, 0)} ₸.`,
    ...(imbalanceInsights.length
      ? imbalanceInsights
      : [data.corridors.length
        ? "Выраженного дисбаланса от двух заявок между встречными направлениями не выявлено."
        : "Данных о грузовых коридорах пока недостаточно для оценки дисбаланса."]),
  ];

  let recommendation: string;
  if (leadingImbalance) {
    const forward = `${leadingImbalance.locationA} → ${leadingImbalance.locationB}`;
    const reverse = leadingImbalance.dominantDirection === forward
      ? `${leadingImbalance.locationB} → ${leadingImbalance.locationA}`
      : forward;
    recommendation = `На направлении ${leadingImbalance.dominantDirection} наблюдается заметный дисбаланс спроса. При появлении встречных заявок ${reverse} их стоит приоритетно проверять как обратный груз.`;
  } else if (data.acceptedReturnMatches > 0) {
    recommendation = "Система уже использует обратные рейсы. Продолжайте приоритетно проверять встречные заявки на активных направлениях.";
  } else if (data.availableOrders > 0 && data.activeDeliveries === 0) {
    recommendation = "Сейчас есть доступные заказы, но активных доставок нет. Основной резерв эффективности — быстрее связывать доступные грузы с перевозчиками и проверять возможность обратной загрузки.";
  } else {
    recommendation = "Недостаточно выраженного дисбаланса для отдельной рекомендации. Продолжайте мониторинг грузопотоков и обратных направлений.";
  }

  return {
    title: "Системная интерпретация грузопотоков",
    summary: "Сводка сформирована локально из текущих агрегированных показателей приложения.",
    insights,
    recommendation,
    disclaimer: "Это системная интерпретация текущих данных, а не ответ Gemini и не прогноз.",
  };
}

export function buildLocalAnalysisFallback(request: AIAnalysisRequest): AIAnalysisResponse {
  return request.type === "return_route_analysis"
    ? buildReturnRouteFallback(request.data.recommendedMatch)
    : buildRegionalFallback(request);
}
