import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { acceptOrder, createOrder, localDemoOrders, seedDemoOrders, subscribeToOrders, updateOrderStatus } from "@/lib/orders";
import { acceptAndPersistRouteMatch, subscribeToRouteMatches } from "@/lib/route-matches";
import type { CargoOrder, CarrierProfile, CreateCargoOrderInput, RankedRouteMatch, RouteMatch } from "@/types/cargo";

interface OrdersContextValue {
  orders: CargoOrder[];
  loading: boolean;
  error: string | null;
  source: "firestore" | "demo";
  routeMatches: RouteMatch[];
  matchesLoading: boolean;
  matchesError: string | null;
  create: (input: CreateCargoOrderInput) => Promise<string>;
  accept: (orderId: string, carrier: CarrierProfile) => Promise<void>;
  acceptMatch: (match: RankedRouteMatch, carrier: CarrierProfile) => Promise<void>;
  changeStatus: (orderId: string, status: "in_transit" | "delivered") => Promise<void>;
  seed: () => Promise<number>;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<CargoOrder[]>(isFirebaseConfigured ? [] : localDemoOrders);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"firestore" | "demo">(isFirebaseConfigured ? "firestore" : "demo");
  const [routeMatches, setRouteMatches] = useState<RouteMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(isFirebaseConfigured);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return subscribeToOrders((nextOrders) => { setOrders(nextOrders); setSource("firestore"); setLoading(false); setError(null); }, () => {
      setOrders(localDemoOrders); setSource("demo"); setLoading(false); setError("Не удалось подключиться к Firestore. Показаны резервные демо-данные.");
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return subscribeToRouteMatches((matches) => { setRouteMatches(matches); setMatchesLoading(false); setMatchesError(null); }, () => { setMatchesLoading(false); setMatchesError("Не удалось загрузить аналитику обратных рейсов из Firestore."); });
  }, []);

  const value = useMemo<OrdersContextValue>(() => ({
    orders, loading, error, source, routeMatches, matchesLoading, matchesError,
    create: async (input) => {
      if (source === "firestore" && isFirebaseConfigured) return createOrder(input);
      const now = new Date().toISOString();
      const id = `LOCAL-${Date.now()}`;
      setOrders((current) => [{ ...input, id, status: "available", pickupDate: input.pickupDate ?? "По договорённости", comment: input.comment, createdAt: now, updatedAt: now }, ...current]);
      return id;
    },
    accept: async (orderId, carrier) => {
      if (source === "firestore" && isFirebaseConfigured) return acceptOrder(orderId, carrier);
      setOrders((current) => current.map((order) => order.id === orderId && order.status === "available" ? { ...order, status: "accepted", carrierName: carrier.name, carrierId: carrier.id, carrierPhone: carrier.phone, carrierVehicleType: carrier.vehicleType, carrierVehiclePlate: carrier.vehiclePlate, acceptedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : order));
    },
    acceptMatch: async (match, carrier) => {
      if (source === "firestore" && isFirebaseConfigured) return acceptAndPersistRouteMatch(match, carrier);
      const available = orders.some((order) => order.id === match.returnOrderId && order.status === "available");
      if (!available) throw new Error("Этот груз уже недоступен. Обновите подбор.");
      const now = new Date().toISOString();
      setOrders((current) => current.map((order) => order.id === match.returnOrderId ? { ...order, status: "accepted", carrierName: carrier.name, carrierId: carrier.id, carrierPhone: carrier.phone, carrierVehicleType: carrier.vehicleType, carrierVehiclePlate: carrier.vehiclePlate, acceptedAt: now, updatedAt: now } : order));
      const { returnOrder: _returnOrder, ...storedMatch } = match;
      void _returnOrder;
      setRouteMatches((current) => current.some((item) => item.id === storedMatch.id) ? current : [...current, { ...storedMatch, createdAt: now }]);
    },
    changeStatus: async (orderId, status) => {
      if (source === "firestore" && isFirebaseConfigured) return updateOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString(), ...(status === "in_transit" ? { startedAt: new Date().toISOString() } : { deliveredAt: new Date().toISOString() }) } : order));
    },
    seed: async () => {
      if (source !== "firestore" || !isFirebaseConfigured) throw new Error("Для загрузки данных требуется подключение к Firestore.");
      return seedDemoOrders();
    },
  }), [orders, loading, error, source, routeMatches, matchesLoading, matchesError]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const value = useContext(OrdersContext);
  if (!value) throw new Error("useOrders must be used inside OrdersProvider");
  return value;
}
