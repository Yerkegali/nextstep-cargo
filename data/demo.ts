import type { CargoOrder, Delivery, LocationReference } from "@/types/cargo";

export const mangystauLocations: Record<string, LocationReference> = {
  aktau: { name: "Актау", region: "Мангистауская область", coordinates: { lat: 43.6532, lng: 51.1975 } },
  zhanaozen: { name: "Жанаозен", region: "Мангистауская область", coordinates: { lat: 43.3412, lng: 52.8619 } },
  beineu: { name: "Бейнеу", region: "Мангистауская область", coordinates: { lat: 45.3247, lng: 55.1935 } },
  shetpe: { name: "Шетпе", region: "Мангистауская область", coordinates: { lat: 44.1666, lng: 52.1167 } },
  fortShevchenko: { name: "Форт-Шевченко", region: "Мангистауская область", coordinates: { lat: 44.5065, lng: 50.2630 } },
  kuryk: { name: "Курык", region: "Мангистауская область", coordinates: { lat: 43.2061, lng: 51.6507 } },
};

// Synthetic records for UI demonstration only. They are not loaded from Firestore.
export const demoCargoOrders: CargoOrder[] = [
  { id: "NC-1042", origin: mangystauLocations.aktau, destination: mangystauLocations.zhanaozen, cargoType: "Стройматериалы", weightKg: 12000, priceKzt: 185000, status: "available", shipperName: "Mangystau Build", createdAt: "2026-08-19T08:30:00+05:00", updatedAt: "2026-08-19T08:30:00+05:00", pickupDate: "Сегодня, 14:00", distanceKm: 151, comment: "12 паллет, боковая загрузка", hasReturnPotential: true },
  { id: "NC-1041", origin: mangystauLocations.kuryk, destination: mangystauLocations.aktau, cargoType: "Оборудование", weightKg: 6800, priceKzt: 128000, status: "available", shipperName: "Caspian Service", createdAt: "2026-08-19T07:50:00+05:00", updatedAt: "2026-08-19T07:50:00+05:00", pickupDate: "Завтра, 09:00", distanceKm: 76, hasReturnPotential: true },
  { id: "NC-1038", origin: mangystauLocations.aktau, destination: mangystauLocations.beineu, cargoType: "Продукты", weightKg: 4200, priceKzt: 260000, status: "available", shipperName: "Aspan Trade", createdAt: "2026-08-18T18:10:00+05:00", updatedAt: "2026-08-18T18:10:00+05:00", pickupDate: "20 авг., 08:00", distanceKm: 470 },
  { id: "NC-1034", origin: mangystauLocations.shetpe, destination: mangystauLocations.fortShevchenko, cargoType: "Тара и упаковка", weightKg: 2400, priceKzt: 142000, status: "accepted", shipperName: "Tau Logistics", createdAt: "2026-08-18T12:15:00+05:00", updatedAt: "2026-08-18T13:15:00+05:00", pickupDate: "20 авг., 11:30", distanceKm: 202, carrierName: "NextStep Demo Driver" },
  { id: "NC-1029", origin: mangystauLocations.zhanaozen, destination: mangystauLocations.aktau, cargoType: "Нефтесервисное оборудование", weightKg: 8900, priceKzt: 210000, status: "in_transit", shipperName: "OzenTech", createdAt: "2026-08-17T10:20:00+05:00", updatedAt: "2026-08-19T07:40:00+05:00", pickupDate: "В пути", distanceKm: 151, hasReturnPotential: true, carrierName: "NextStep Demo Driver" },
  { id: "NC-1024", origin: mangystauLocations.aktau, destination: mangystauLocations.shetpe, cargoType: "Стройматериалы", weightKg: 15600, priceKzt: 175000, status: "delivered", shipperName: "Mangystau Build", createdAt: "2026-08-16T09:00:00+05:00", updatedAt: "2026-08-18T16:10:00+05:00", pickupDate: "Доставлен", distanceKm: 160, carrierName: "NextStep Demo Driver" },
];

export const demoDeliveries: Delivery[] = [
  { id: "DEL-412", orderId: "NC-1029", carrierName: "Арман С.", vehicleLabel: "Volvo FH · 017 KZA", status: "in_transit", startedAt: "2026-08-19T07:40:00+05:00" },
  { id: "DEL-407", orderId: "NC-1024", carrierName: "Ерлан Т.", vehicleLabel: "DAF XF · 814 MAA", status: "delivered", completedAt: "2026-08-18T16:10:00+05:00" },
];

export const corridorStats = [
  { route: "Актау → Жанаозен", loads: 38, share: 82 },
  { route: "Актау → Бейнеу", loads: 24, share: 58 },
  { route: "Актау → Шетпе", loads: 19, share: 44 },
];
