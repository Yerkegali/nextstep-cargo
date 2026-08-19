import type { CargoOrder, RankedRouteMatch, RouteMatch } from "@/types/cargo";
import type { AIAnalysisRequest, RegionalFlowAnalysisPayload, ReturnRouteAnalysisPayload, SafeRouteMatchFacts } from "@/lib/ai/types";

function toSafeMatch(match: RankedRouteMatch): SafeRouteMatchFacts {
  return {
    origin: match.returnOrigin.name,
    destination: match.returnDestination.name,
    matchScore: match.matchScore,
    matchType: match.matchType,
    emptyKmBefore: match.emptyKmBefore,
    repositionKm: match.repositionKm,
    emptyKmAfter: match.emptyKmAfter,
    savedKm: match.savedKm,
    fuelSavedLiters: match.fuelSavedLiters,
    estimatedSavingsKzt: match.estimatedSavingsKzt,
  };
}

export function buildReturnRouteAnalysisRequest(original: CargoOrder, matches: RankedRouteMatch[]): AIAnalysisRequest | null {
  if (!matches.length) return null;
  const data: ReturnRouteAnalysisPayload = {
    completedRoute: { origin: original.origin.name, destination: original.destination.name, distanceKm: original.distanceKm },
    recommendedMatch: toSafeMatch(matches[0]),
    alternatives: matches.slice(1, 4).map(toSafeMatch),
  };
  return { type: "return_route_analysis", data };
}

export function buildRegionalFlowAnalysisRequest(orders: CargoOrder[], routeMatches: RouteMatch[]): AIAnalysisRequest {
  const corridorCounts = new Map<string, { from: string; to: string; orders: number }>();
  for (const order of orders) {
    const key = `${order.origin.name}|${order.destination.name}`;
    const existing = corridorCounts.get(key);
    if (existing) existing.orders += 1;
    else corridorCounts.set(key, { from: order.origin.name, to: order.destination.name, orders: 1 });
  }
  const corridors = [...corridorCounts.values()].sort((a, b) => b.orders - a.orders || `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`));
  const pairs = new Map<string, [string, string]>();
  for (const corridor of corridors) {
    const pair = [corridor.from, corridor.to].sort((a, b) => a.localeCompare(b)) as [string, string];
    pairs.set(pair.join("|"), pair);
  }
  const imbalances = [...pairs.values()].map(([locationA, locationB]) => {
    const aToB = corridorCounts.get(`${locationA}|${locationB}`)?.orders ?? 0;
    const bToA = corridorCounts.get(`${locationB}|${locationA}`)?.orders ?? 0;
    return { locationA, locationB, aToB, bToA, difference: Math.abs(aToB - bToA), dominantDirection: aToB === bToA ? null : aToB > bToA ? `${locationA} → ${locationB}` : `${locationB} → ${locationA}` };
  }).sort((a, b) => b.difference - a.difference);

  const data: RegionalFlowAnalysisPayload = {
    availableOrders: orders.filter((order) => order.status === "available").length,
    activeDeliveries: orders.filter((order) => order.status === "accepted" || order.status === "in_transit").length,
    deliveredOrders: orders.filter((order) => order.status === "delivered").length,
    acceptedReturnMatches: routeMatches.length,
    savings: {
      savedKm: Math.round(routeMatches.reduce((sum, match) => sum + match.savedKm, 0)),
      fuelSavedLiters: Math.round(routeMatches.reduce((sum, match) => sum + match.fuelSavedLiters, 0) * 10) / 10,
      estimatedSavingsKzt: Math.round(routeMatches.reduce((sum, match) => sum + match.estimatedSavingsKzt, 0)),
    },
    corridors: corridors.slice(0, 12),
    imbalances: imbalances.slice(0, 8),
  };
  return { type: "regional_flow_analysis", data };
}

