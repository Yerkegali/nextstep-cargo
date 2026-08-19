import { getDistanceKm } from "@/lib/distances";
import type { CargoOrder, RankedRouteMatch, RouteMatch } from "@/types/cargo";

export const planningAssumptions = {
  truckFuelConsumptionLitersPer100Km: 28,
  fuelPriceKztPerLiter: 300,
  minimumSavingKm: 10,
  minimumSavingRatio: 0.1,
} as const;

export function calculateRouteMatch(original: CargoOrder, candidate: CargoOrder): RankedRouteMatch | null {
  if (original.status !== "delivered" || candidate.status !== "available" || original.id === candidate.id) return null;
  const a = original.origin.name;
  const b = original.destination.name;
  const c = candidate.origin.name;
  const d = candidate.destination.name;
  if (!a || !b || !c || !d || a === b || c === d) return null;

  const emptyKmBefore = getDistanceKm(b, a);
  const repositionKm = getDistanceKm(b, c);
  const remainingEmptyKm = getDistanceKm(d, a);
  const loadedDistance = getDistanceKm(c, d);
  if (emptyKmBefore === null || repositionKm === null || remainingEmptyKm === null || loadedDistance === null || emptyKmBefore <= 0 || loadedDistance <= 0) return null;

  const emptyKmAfter = repositionKm + remainingEmptyKm;
  const savedKm = Math.max(0, emptyKmBefore - emptyKmAfter);
  const savingRatio = savedKm / emptyKmBefore;
  if (savedKm < planningAssumptions.minimumSavingKm || savingRatio < planningAssumptions.minimumSavingRatio) return null;

  const direct = c === b && d === a;
  const matchType: RouteMatch["matchType"] = direct ? "direct_return" : c !== b ? "nearby_return" : "partial_return";
  const repositionFactor = Math.max(0, 1 - repositionKm / emptyKmBefore);
  const destinationFactor = Math.max(0, 1 - remainingEmptyKm / emptyKmBefore);
  const matchScore = Math.min(99, Math.round(savingRatio * 60 + repositionFactor * 20 + destinationFactor * 15 + (direct ? 5 : 0)));
  const fuelSavedLiters = Math.round(savedKm * planningAssumptions.truckFuelConsumptionLitersPer100Km) / 100;
  const estimatedSavingsKzt = Math.round((fuelSavedLiters * planningAssumptions.fuelPriceKztPerLiter) / 100) * 100;
  const reason = direct ? "Прямой обратный маршрут" : c !== b ? `Точка погрузки рядом, маршрут возвращает автомобиль в сторону ${a}` : `Маршрут из ${b} сокращает пустой путь в сторону ${a}`;

  return {
    id: `${original.id}_${candidate.id}`,
    originalOrderId: original.id,
    returnOrderId: candidate.id,
    originalOrigin: original.origin,
    originalDestination: original.destination,
    returnOrigin: candidate.origin,
    returnDestination: candidate.destination,
    emptyKmBefore,
    repositionKm,
    emptyKmAfter,
    savedKm,
    fuelSavedLiters,
    estimatedSavingsKzt,
    matchScore,
    matchType,
    reason,
    createdAt: new Date().toISOString(),
    returnOrder: candidate,
  };
}

export function findReturnCargoMatches(original: CargoOrder, orders: CargoOrder[]): RankedRouteMatch[] {
  return orders.map((candidate) => calculateRouteMatch(original, candidate)).filter((match): match is RankedRouteMatch => match !== null).sort((a, b) => b.matchScore - a.matchScore || b.savedKm - a.savedKm || a.repositionKm - b.repositionKm || a.returnOrderId.localeCompare(b.returnOrderId));
}
