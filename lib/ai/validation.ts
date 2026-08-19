import type { AIAnalysisRequest, AIAnalysisResponse, RegionalFlowAnalysisPayload, ReturnRouteAnalysisPayload, SafeRouteMatchFacts } from "@/lib/ai/types";

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown, max = 100): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isNumber = (value: unknown, max = 10_000_000): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;

function isSafeMatch(value: unknown): value is SafeRouteMatchFacts {
  if (!isObject(value)) return false;
  return isText(value.origin, 64) && isText(value.destination, 64) && isNumber(value.matchScore, 100) && ["direct_return", "nearby_return", "partial_return"].includes(String(value.matchType)) && isNumber(value.emptyKmBefore) && isNumber(value.repositionKm) && isNumber(value.emptyKmAfter) && isNumber(value.savedKm) && isNumber(value.fuelSavedLiters) && isNumber(value.estimatedSavingsKzt);
}

function isReturnData(value: unknown): value is ReturnRouteAnalysisPayload {
  if (!isObject(value) || !isObject(value.completedRoute) || !isSafeMatch(value.recommendedMatch) || !Array.isArray(value.alternatives) || value.alternatives.length > 3) return false;
  return isText(value.completedRoute.origin, 64) && isText(value.completedRoute.destination, 64) && isNumber(value.completedRoute.distanceKm) && value.alternatives.every(isSafeMatch);
}

function isRegionalData(value: unknown): value is RegionalFlowAnalysisPayload {
  if (!isObject(value) || !isNumber(value.availableOrders, 100000) || !isNumber(value.activeDeliveries, 100000) || !isNumber(value.deliveredOrders, 100000) || !isNumber(value.acceptedReturnMatches, 100000) || !isObject(value.savings)) return false;
  if (!isNumber(value.savings.savedKm) || !isNumber(value.savings.fuelSavedLiters) || !isNumber(value.savings.estimatedSavingsKzt)) return false;
  if (!Array.isArray(value.corridors) || value.corridors.length > 12 || !value.corridors.every((item) => isObject(item) && isText(item.from, 64) && isText(item.to, 64) && isNumber(item.orders, 100000))) return false;
  return Array.isArray(value.imbalances) && value.imbalances.length <= 8 && value.imbalances.every((item) => isObject(item) && isText(item.locationA, 64) && isText(item.locationB, 64) && isNumber(item.aToB, 100000) && isNumber(item.bToA, 100000) && isNumber(item.difference, 100000) && (item.dominantDirection === null || isText(item.dominantDirection, 140)));
}

export function parseAnalysisRequest(value: unknown): AIAnalysisRequest | null {
  if (!isObject(value)) return null;
  if (value.type === "return_route_analysis" && isReturnData(value.data)) return { type: value.type, data: value.data };
  if (value.type === "regional_flow_analysis" && isRegionalData(value.data)) return { type: value.type, data: value.data };
  return null;
}

export function parseAnalysisResponse(value: unknown): AIAnalysisResponse | null {
  if (!isObject(value) || !isText(value.title, 100) || !isText(value.summary, 700) || !Array.isArray(value.insights) || value.insights.length < 1 || value.insights.length > 4 || !value.insights.every((item) => isText(item, 350))) return null;
  if (value.recommendation !== undefined && !isText(value.recommendation, 500)) return null;
  if (value.disclaimer !== undefined && !isText(value.disclaimer, 350)) return null;
  return { title: value.title.trim(), summary: value.summary.trim(), insights: value.insights.map((item) => item.trim()), recommendation: typeof value.recommendation === "string" ? value.recommendation.trim() : undefined, disclaimer: typeof value.disclaimer === "string" ? value.disclaimer.trim() : undefined };
}
