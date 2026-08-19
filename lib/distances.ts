/**
 * Synthetic/reference road distances for hackathon planning calculations.
 * These are symmetric estimates, not live routing or GPS measurements.
 */
const referenceDistances: Record<string, number> = {
  "Актау|Жанаозен": 151,
  "Актау|Бейнеу": 470,
  "Актау|Шетпе": 160,
  "Актау|Форт-Шевченко": 135,
  "Актау|Курык": 76,
  "Жанаозен|Бейнеу": 330,
  "Жанаозен|Шетпе": 155,
  "Жанаозен|Форт-Шевченко": 285,
  "Жанаозен|Курык": 100,
  "Бейнеу|Шетпе": 310,
  "Бейнеу|Форт-Шевченко": 520,
  "Бейнеу|Курык": 520,
  "Шетпе|Форт-Шевченко": 202,
  "Шетпе|Курык": 230,
  "Форт-Шевченко|Курык": 205,
};

export function getDistanceKm(from: string, to: string): number | null {
  if (!from || !to) return null;
  if (from === to) return 0;
  return referenceDistances[`${from}|${to}`] ?? referenceDistances[`${to}|${from}`] ?? null;
}

export function getKnownRouteDistanceKm(from: string, to: string): number {
  return getDistanceKm(from, to) ?? 0;
}

export const distanceAssumptions = {
  source: "Справочная матрица расстояний NextStep Cargo для MVP",
  isLiveGps: false,
} as const;
