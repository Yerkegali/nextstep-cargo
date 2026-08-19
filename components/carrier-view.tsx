import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useOrders } from "@/components/orders-provider";
import { ReturnMatchPanel } from "@/components/return-match-panel";
import { CarrierProfileForm, CarrierProfileSummary, useCarrierProfile } from "@/components/carrier-profile";
import { DEMO_CARRIER_ID, getOrderErrorMessage } from "@/lib/orders";
import type { CargoOrder, RankedRouteMatch } from "@/types/cargo";

const formatPrice = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const formatWeight = (kg: number) => kg >= 1000 ? `${(kg / 1000).toLocaleString("ru-RU")} т` : `${kg} кг`;
const statusLabels = { accepted: "Принят", in_transit: "В пути", delivered: "Доставлен" } as const;

function CargoCard({ order, busy, onAccept }: { order: CargoOrder; busy: boolean; onAccept: () => void }) {
  return <article className="cargo-card">
    <div className="card-topline"><span className="order-id">{order.id}</span><span className="status-dot">Доступен</span></div>
    <div className="route-line"><div><span>Откуда</span><strong>{order.origin.name}</strong></div><div className="route-arrow"><i/><Icon name="arrow" className="size-5"/></div><div><span>Куда</span><strong>{order.destination.name}</strong></div></div>
    {order.hasReturnPotential && <div className="return-badge"><Icon name="spark" className="size-4"/><span><strong>Потенциал обратного груза</strong> · маршрут подходит для будущего сопоставления</span></div>}
    <div className="cargo-details"><div><span>Груз</span><strong>{order.cargoType}</strong></div><div><span>Вес</span><strong>{formatWeight(order.weightKg)}</strong></div><div><span>Расстояние</span><strong>≈ {order.distanceKm} км</strong></div></div>
    <div className="pickup"><Icon name="clock" className="size-4"/><span>Погрузка: {order.pickupDate}</span></div>
    <div className="card-actions"><div className="price"><span>Стоимость</span><strong>{formatPrice(order.priceKzt)} ₸</strong></div><button type="button" className="primary-button" disabled={busy} onClick={onAccept}>{busy ? "Принимаем…" : "Взять заказ"} {!busy && <Icon name="chevron" className="size-4"/>}</button></div>
  </article>;
}

function TripCard({ order, busy, onAdvance, onFindReturn }: { order: CargoOrder; busy: boolean; onAdvance: () => void; onFindReturn: () => void }) {
  const delivered = order.status === "delivered";
  return <article className={`trip-card ${delivered ? "delivered" : ""}`}><div className="trip-head"><div><span className={`trip-status ${order.status}`}>{statusLabels[order.status as keyof typeof statusLabels]}</span><small>{order.id}</small></div><strong>{formatPrice(order.priceKzt)} ₸</strong></div><div className="mini-route trip-route"><span>{order.origin.name}</span><Icon name="arrow" className="size-4"/><span>{order.destination.name}</span></div><p>{order.cargoType} · {formatWeight(order.weightKg)} · ≈ {order.distanceKm} км</p>{delivered ? <div className="return-cta"><div><Icon name="spark" className="size-5"/><span><strong>Рейс завершён</strong><small>Ищите груз из {order.destination.name} в сторону {order.origin.name}</small></span></div><button type="button" className="primary-button" onClick={onFindReturn}>Найти обратный груз</button></div> : <button type="button" className="secondary-button" disabled={busy} onClick={onAdvance}>{busy ? "Обновляем…" : order.status === "accepted" ? "Начать рейс" : "Завершить доставку"}<Icon name="arrow" className="size-4"/></button>}</article>;
}

export function CarrierView() {
  const { orders: allOrders, loading, error, source, accept, acceptMatch, changeStatus } = useOrders();
  const { profile, ready: profileReady, saveProfile } = useCarrierProfile();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [matchingOrderId, setMatchingOrderId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const available = useMemo(() => allOrders.filter((order) => order.status === "available" && `${order.origin.name} ${order.destination.name} ${order.cargoType}`.toLowerCase().includes(query.toLowerCase())), [allOrders, query]);
  const trips = profile ? allOrders.filter((order) => order.carrierId === profile.id && order.status !== "available") : [];
  const legacyTrips = allOrders.filter((order) => order.status !== "available" && (!order.carrierId || order.carrierId === DEMO_CARRIER_ID));

  async function handleAccept(order: CargoOrder) { if (!profile) return setEditingProfile(true); setBusyId(order.id); setFeedback(null); try { await accept(order.id, profile); setFeedback({ type: "success", text: `Заказ ${order.origin.name} → ${order.destination.name} принят. Он добавлен в «Мои рейсы».` }); } catch (caught) { setFeedback({ type: "error", text: getOrderErrorMessage(caught, "Не удалось принять заказ. Попробуйте ещё раз.") }); } finally { setBusyId(null); } }
  async function handleAdvance(order: CargoOrder) { setBusyId(order.id); setFeedback(null); try { await changeStatus(order.id, order.status === "accepted" ? "in_transit" : "delivered"); setFeedback({ type: "success", text: order.status === "accepted" ? "Рейс начат. Статус обновлён для всех участников." : "Доставка завершена. Теперь можно подобрать обратный груз." }); } catch (caught) { setFeedback({ type: "error", text: getOrderErrorMessage(caught, "Не удалось обновить статус. Проверьте соединение и повторите попытку.") }); } finally { setBusyId(null); } }
  async function handleAcceptMatch(match: RankedRouteMatch) { if (!profile) return setEditingProfile(true); setBusyId(match.returnOrderId); setFeedback(null); try { await acceptMatch(match, profile); setMatchingOrderId(null); setFeedback({ type: "success", text: `Обратный груз ${match.returnOrigin.name} → ${match.returnDestination.name} принят. Плановая экономия: ${match.savedKm} км пустого пробега.` }); } catch (caught) { setFeedback({ type: "error", text: getOrderErrorMessage(caught, "Не удалось принять обратный груз. Обновите подбор и повторите попытку.") }); } finally { setBusyId(null); } }
  const matchingOrder = allOrders.find((order) => order.id === matchingOrderId && order.status === "delivered");

  if (!profileReady) return <section className="view-section"><div className="loading-state" role="status"><span className="spinner" aria-hidden="true"/> Загружаем профиль перевозчика…</div></section>;
  if (!profile || editingProfile) return <CarrierProfileForm profile={profile} onSave={(input) => { saveProfile(input); setEditingProfile(false); }} onCancel={profile ? () => setEditingProfile(false) : undefined}/>;

  return <section className="view-section carrier-view">
    <div className="section-heading"><div><p className="eyebrow">Биржа грузов</p><h1>Доступные заказы</h1><p>Найдите выгодный рейс без пустого обратного пути.</p></div><div className="availability"><span>{available.length}</span><div>активных<br/>заказов</div></div></div>
    <div className="connection-line"><span className={source === "firestore" ? "connected" : "demo"}><i/>{source === "firestore" ? "Firestore · в реальном времени" : "Резервный демо-режим"}</span></div>
    <CarrierProfileSummary profile={profile} onEdit={() => setEditingProfile(true)}/>
    {(feedback || error) && <div className={`inline-feedback ${feedback?.type === "error" || error ? "error" : "success"}`} role="status">{feedback?.type === "success" && <Icon name="check" className="size-4"/>}<span>{feedback?.text ?? error}</span></div>}
    {legacyTrips.length > 0 && <div className="legacy-note"><Icon name="shield" className="size-4"/><span>Прежние демо-рейсы ({legacyTrips.length}) сохранены в базе, но не привязаны к текущему профилю.</span></div>}
    {trips.length > 0 && <div className="trips-section"><div className="subsection-title"><div><p className="eyebrow">Демо-перевозчик</p><h2>Мои рейсы</h2></div><span>{trips.filter((order) => order.status !== "delivered").length} активных</span></div><div className="trips-grid">{trips.map((order) => <TripCard key={order.id} order={order} busy={busyId === order.id} onAdvance={() => handleAdvance(order)} onFindReturn={() => { setFeedback(null); setMatchingOrderId(order.id); }}/>)}</div></div>}
    {matchingOrder && <ReturnMatchPanel original={matchingOrder} orders={allOrders} busyId={busyId} onAccept={handleAcceptMatch} onClose={() => setMatchingOrderId(null)}/>} 
    <div className="smart-banner"><div className="smart-icon"><Icon name="route" className="size-6"/></div><div><strong>Умный подбор обратного маршрута</strong><p>Детерминированный расчёт сравнивает доступные грузы и сокращает порожний пробег.</p></div><span className="live-pill"><i/> активно</span></div>
    <div className="search-row"><label className="search-box"><span className="sr-only">Поиск грузов</span><Icon name="search" className="size-5"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Маршрут или тип груза"/></label><button type="button" className="filter-button" aria-label="Открыть фильтры"><Icon name="filter" className="size-5"/><span>Фильтры</span></button></div>
    <div className="filter-chips"><button type="button" className="active">Все грузы</button><button type="button">Сегодня</button><button type="button">Обратный груз</button><button type="button">До 10 тонн</button></div>
    {loading ? <div className="loading-state" role="status"><span className="spinner" aria-hidden="true"/> Загружаем заказы…</div> : <><div className="orders-grid">{available.map((order) => <CargoCard key={order.id} order={order} busy={busyId === order.id} onAccept={() => handleAccept(order)}/>)}</div>{available.length === 0 && <div className="empty-state">{query ? "По вашему запросу грузов пока нет." : "Сейчас нет доступных заказов."}</div>}</>}
  </section>;
}
