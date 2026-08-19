import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type DocumentReference,
  type FirestoreError,
  type Timestamp,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import { demoCargoOrders, mangystauLocations } from "@/data/demo";
import { firestore } from "@/lib/firebase";
import { getKnownRouteDistanceKm } from "@/lib/distances";
import type { CargoOrder, CreateCargoOrderInput, OrderStatus } from "@/types/cargo";

export const DEMO_CARRIER_NAME = "NextStep Demo Driver";
export const DEMO_CARRIER_ID = "demo-carrier";

export class OrdersServiceError extends Error {
  constructor(message: string, public readonly code = "orders/unknown") { super(message); }
}

export function getOrderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof OrdersServiceError) return error.message;
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code.includes("permission-denied")) return "Firestore отклонил операцию. Проверьте правила доступа для демо.";
    if (code.includes("unavailable") || code.includes("network")) return "Нет соединения с Firestore. Проверьте интернет и повторите попытку.";
  }
  return fallback;
}

function requireFirestore() {
  if (!firestore) throw new OrdersServiceError("Firebase не настроен. Используется локальный демо-режим.", "orders/not-configured");
  return firestore;
}

function toIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) return (value as Timestamp).toDate().toISOString();
  return typeof value === "string" ? value : new Date().toISOString();
}

function mapOrder(id: string, data: DocumentData): CargoOrder {
  return {
    id,
    origin: data.origin,
    destination: data.destination,
    cargoType: data.cargoType,
    weightKg: Number(data.weightKg),
    priceKzt: Number(data.priceKzt),
    status: data.status,
    shipperName: data.shipperName ?? "Демо-отправитель",
    comment: data.comment ?? "",
    distanceKm: Number(data.distanceKm ?? 0),
    pickupDate: data.pickupDate ?? "По договорённости",
    hasReturnPotential: Boolean(data.hasReturnPotential),
    carrierName: data.carrierName,
    carrierId: data.carrierId,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    acceptedAt: data.acceptedAt ? toIso(data.acceptedAt) : undefined,
    startedAt: data.startedAt ? toIso(data.startedAt) : undefined,
    deliveredAt: data.deliveredAt ? toIso(data.deliveredAt) : undefined,
  };
}

export function subscribeToOrders(onData: (orders: CargoOrder[]) => void, onError: (error: FirestoreError) => void): Unsubscribe {
  const db = requireFirestore();
  return onSnapshot(collection(db, "orders"), (snapshot) => {
    const orders = snapshot.docs.map((item) => mapOrder(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    onData(orders);
  }, onError);
}

export function subscribeToAvailableOrders(onData: (orders: CargoOrder[]) => void, onError: (error: FirestoreError) => void): Unsubscribe {
  return subscribeToOrders((orders) => onData(orders.filter((order) => order.status === "available")), onError);
}

export function subscribeToRecentOrders(onData: (orders: CargoOrder[]) => void, onError: (error: FirestoreError) => void): Unsubscribe {
  return subscribeToOrders(onData, onError);
}

export async function createOrder(input: CreateCargoOrderInput): Promise<string> {
  const db = requireFirestore();
  const reference = await addDoc(collection(db, "orders"), {
    ...input,
    comment: input.comment ?? "",
    pickupDate: input.pickupDate ?? "По договорённости",
    status: "available" satisfies OrderStatus,
    hasReturnPotential: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function acceptOrder(orderId: string): Promise<void> {
  const db = requireFirestore();
  const reference = doc(db, "orders", orderId);
  await runTransaction(db, async (transaction) => {
    await stageOrderAcceptance(transaction, reference);
  });
}

export async function stageOrderAcceptance(transaction: Transaction, reference: DocumentReference): Promise<void> {
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists()) throw new OrdersServiceError("Заказ больше не существует.", "orders/not-found");
  if (snapshot.data().status !== "available") throw new OrdersServiceError("Этот груз уже принял другой перевозчик. Обновите подбор.", "orders/already-accepted");
  transaction.update(reference, { status: "accepted", carrierName: DEMO_CARRIER_NAME, carrierId: DEMO_CARRIER_ID, acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateOrderStatus(orderId: string, nextStatus: "in_transit" | "delivered"): Promise<void> {
  const db = requireFirestore();
  const reference = doc(db, "orders", orderId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new OrdersServiceError("Заказ не найден.", "orders/not-found");
    const current = snapshot.data().status as OrderStatus;
    const valid = (current === "accepted" && nextStatus === "in_transit") || (current === "in_transit" && nextStatus === "delivered");
    if (!valid) throw new OrdersServiceError("Статус заказа уже изменился. Обновите данные.", "orders/invalid-transition");
    transaction.update(reference, { status: nextStatus, updatedAt: serverTimestamp(), ...(nextStatus === "in_transit" ? { startedAt: serverTimestamp() } : { deliveredAt: serverTimestamp() }) });
  });
}

// Explicit, idempotent seed for synthetic hackathon records. Stable IDs prevent duplicates.
export async function seedDemoOrders(): Promise<number> {
  const db = requireFirestore();
  const seed = [
    ["seed-aktau-zhanaozen", "aktau", "zhanaozen", "Стройматериалы", 12000, 185000],
    ["seed-zhanaozen-aktau", "zhanaozen", "aktau", "Запчасти", 7600, 198000],
    ["seed-aktau-beineu", "aktau", "beineu", "Продукты", 4200, 260000],
    ["seed-beineu-aktau", "beineu", "aktau", "Бытовые товары", 5400, 275000],
    ["seed-aktau-shetpe", "aktau", "shetpe", "Оборудование", 9800, 168000],
    ["seed-shetpe-aktau", "shetpe", "aktau", "Стройматериалы", 6100, 154000],
    ["seed-kuryk-aktau", "kuryk", "aktau", "Оборудование", 6800, 128000],
    ["seed-zhanaozen-kuryk", "zhanaozen", "kuryk", "Запчасти", 3200, 146000],
  ] as const;
  const created = await Promise.all(seed.map(([id, from, to, cargoType, weightKg, priceKzt]) => runTransaction(db, async (transaction) => {
    const reference = doc(db, "orders", id);
    const existing = await transaction.get(reference);
    if (existing.exists()) return false;
    transaction.set(reference, {
      origin: mangystauLocations[from], destination: mangystauLocations[to], cargoType, weightKg, priceKzt, distanceKm: getKnownRouteDistanceKm(mangystauLocations[from].name, mangystauLocations[to].name),
      status: "available", shipperName: "NextStep Demo Shipper", comment: "Синтетическая заявка для демонстрации хакатона", pickupDate: "По договорённости",
      hasReturnPotential: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), demoSeed: true,
    });
    return true;
  })));
  return created.filter(Boolean).length;
}

export const localDemoOrders = demoCargoOrders;
