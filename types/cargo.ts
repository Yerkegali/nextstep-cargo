export type UserRole = "shipper" | "carrier" | "dispatcher";

export type OrderStatus = "available" | "accepted" | "in_transit" | "delivered";

export type DeliveryStatus = "assigned" | "loading" | "in_transit" | "delivered";

export type CargoType =
  | "Стройматериалы"
  | "Продукты"
  | "Оборудование"
  | "Запчасти"
  | "Бытовые товары"
  | "Тара и упаковка"
  | "Нефтесервисное оборудование"
  | "Прочее";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface LocationReference {
  name: string;
  region: "Мангистауская область";
  coordinates: GeoPoint;
}

export interface CargoOrder {
  id: string;
  origin: LocationReference;
  destination: LocationReference;
  cargoType: CargoType;
  weightKg: number;
  priceKzt: number;
  status: OrderStatus;
  shipperName: string;
  createdAt: string;
  updatedAt: string;
  pickupDate: string;
  distanceKm: number;
  comment?: string;
  hasReturnPotential?: boolean;
  carrierName?: string;
  carrierId?: string;
  acceptedAt?: string;
  startedAt?: string;
  deliveredAt?: string;
}

export type CreateCargoOrderInput = Pick<CargoOrder, "origin" | "destination" | "cargoType" | "weightKg" | "priceKzt" | "distanceKm" | "shipperName"> & {
  comment?: string;
  pickupDate?: string;
};

export interface Delivery {
  id: string;
  orderId: string;
  carrierName: string;
  vehicleLabel: string;
  status: DeliveryStatus;
  startedAt?: string;
  completedAt?: string;
}

export interface RouteMatch {
  id: string;
  originalOrderId: string;
  returnOrderId: string;
  originalOrigin: LocationReference;
  originalDestination: LocationReference;
  returnOrigin: LocationReference;
  returnDestination: LocationReference;
  emptyKmBefore: number;
  repositionKm: number;
  emptyKmAfter: number;
  savedKm: number;
  fuelSavedLiters: number;
  estimatedSavingsKzt: number;
  matchScore: number;
  matchType: "direct_return" | "nearby_return" | "partial_return";
  reason: string;
  createdAt: string;
}

export interface RankedRouteMatch extends RouteMatch {
  returnOrder: CargoOrder;
}
