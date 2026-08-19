import { Icon } from "@/components/icons";
import type { CargoOrder } from "@/types/cargo";

export function CarrierAssignment({ order, compact = false }: { order: CargoOrder; compact?: boolean }) {
  const vehicle = [order.carrierVehicleType, order.carrierVehiclePlate].filter(Boolean).join(" · ");
  return <div className={`carrier-assignment ${compact ? "compact" : ""}`}><span><Icon name="truck" className="size-4"/></span><p><small>Перевозчик</small><strong>{order.carrierName?.trim() || "Перевозчик не указан"}</strong><em>{vehicle || "Транспорт не указан"}</em></p></div>;
}
