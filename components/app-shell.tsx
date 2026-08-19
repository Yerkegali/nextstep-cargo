"use client";

import { useState } from "react";
import { CarrierView } from "@/components/carrier-view";
import { DispatcherView } from "@/components/dispatcher-view";
import { Icon } from "@/components/icons";
import { MobileNavigation, RoleSwitcher } from "@/components/role-switcher";
import { OrdersProvider } from "@/components/orders-provider";
import { ShipperView } from "@/components/shipper-view";
import type { UserRole } from "@/types/cargo";

export function AppShell() {
  const [role, setRole] = useState<UserRole>("carrier");
  return <OrdersProvider><div className="app-shell"><header className="app-header"><div className="header-inner"><button type="button" className="brand" onClick={() => setRole("carrier")} aria-label="NextStep Cargo — открыть заказы"><span className="brand-mark"><Icon name="route" className="size-6"/></span><span><strong>NextStep <i>Cargo</i></strong><small>Умная логистика Мангистау</small></span></button><RoleSwitcher role={role} onChange={setRole}/><div className="demo-badge"><i/> Демо MVP</div></div></header><main>{role === "carrier" ? <CarrierView/> : role === "shipper" ? <ShipperView/> : <DispatcherView/>}</main><MobileNavigation role={role} onChange={setRole}/></div></OrdersProvider>;
}
