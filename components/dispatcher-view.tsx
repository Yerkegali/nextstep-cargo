import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useOrders } from "@/components/orders-provider";
import { CarrierAssignment } from "@/components/carrier-assignment";
import { AIAnalysisPanel } from "@/components/ai-analysis-panel";
import { buildRegionalFlowAnalysisRequest } from "@/lib/ai/analytics";

const estimatedMetrics: { label: string; value: string; note: string; icon: IconName; tone: string }[] = [
  { label: "Порожний пробег", value: "31%", note: "оценка по демо-данным", icon: "route", tone: "red" },
];

export function DispatcherView() {
  const { orders, loading, error, source, seed, routeMatches, matchesLoading, matchesError } = useOrders();
  const [seeding, setSeeding] = useState(false);
  const [seedFeedback, setSeedFeedback] = useState<string | null>(null);
  const available = orders.filter((order) => order.status === "available").length;
  const active = orders.filter((order) => order.status === "accepted" || order.status === "in_transit").length;
  const delivered = orders.filter((order) => order.status === "delivered").length;
  const assignedOrders = orders.filter((order) => order.status !== "available").slice(0, 4);
  const savedKm = Math.round(routeMatches.reduce((total, match) => total + match.savedKm, 0));
  const fuelSaved = Math.round(routeMatches.reduce((total, match) => total + match.fuelSavedLiters, 0));
  const moneySaved = Math.round(routeMatches.reduce((total, match) => total + match.estimatedSavingsKzt, 0));
  const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
  const liveNote = source === "firestore" ? "данные Firestore · live" : "синтетический резервный набор";
  const aiRequest = useMemo(() => buildRegionalFlowAnalysisRequest(orders, routeMatches), [orders, routeMatches]);
  const metrics: { label: string; value: string; note: string; icon: IconName; tone: string }[] = [
    { label: "Активные доставки", value: String(active), note: source === "firestore" ? "принятые и в пути · live" : liveNote, icon: "truck", tone: "blue" },
    { label: "Доступные заказы", value: String(available), note: liveNote, icon: "box", tone: "sand" },
    { label: "Доставлено", value: String(delivered), note: source === "firestore" ? "завершённые заявки · live" : liveNote, icon: "check", tone: "green" },
    ...estimatedMetrics,
  ];
  const liveCorridors = useMemo(() => {
    if (!orders.length) return [];
    const counts = new Map<string, number>();
    orders.forEach((order) => { const route = `${order.origin.name} → ${order.destination.name}`; counts.set(route, (counts.get(route) ?? 0) + 1); });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const max = sorted[0]?.[1] ?? 1;
    return sorted.map(([route, loads]) => ({ route, loads, share: Math.max(18, (loads / max) * 100) }));
  }, [orders]);
  async function handleSeed() { setSeeding(true); setSeedFeedback(null); try { const count = await seed(); setSeedFeedback(count ? `${count} синтетических заявок добавлено без дублей.` : "Демо-заявки уже существуют — данные не сброшены."); } catch { setSeedFeedback("Не удалось загрузить демо-данные. Проверьте Firestore и правила доступа."); } finally { setSeeding(false); } }
  return <section className="view-section dispatcher-view">
    <div className="section-heading dashboard-heading"><div><p className="eyebrow">Региональная аналитика</p><h1>Логистический обзор</h1><p>Агрегированные потоки Мангистауской области · live + оценочные данные</p></div><div className="dashboard-actions"><div className="period-control"><span>Источник</span><strong>{source === "firestore" ? "Firestore · live" : "Демо-данные"}</strong></div><button type="button" className="seed-button" disabled={seeding || source !== "firestore"} onClick={handleSeed}>{seeding ? "Загрузка…" : "Заполнить демо-данными"}</button></div></div>
    {(error || matchesError || seedFeedback) && <div className={`inline-feedback ${error || matchesError ? "error" : "success"}`} role="status"><span>{error ?? matchesError ?? seedFeedback}</span></div>}
    <div className="metrics-grid">{metrics.map((metric) => <article className="metric-card" key={metric.label}><div className={`metric-icon ${metric.tone}`}><Icon name={metric.icon} className="size-5"/></div><p>{metric.label}</p><strong>{loading ? "—" : metric.value}</strong><span>{metric.note}</span></article>)}</div>
    <AIAnalysisPanel request={aiRequest} buttonLabel="AI-анализ грузопотоков" heading="AI-анализ грузопотоков"/>
    <div className="dashboard-grid"><article className="map-card"><div className="panel-heading"><div><p className="eyebrow">Карта потоков</p><h2>Мангистауская область</h2></div><span className="map-legend"><i/> Интенсивность перевозок</span></div><div className="map-placeholder" role="img" aria-label="Схематичная карта грузовых направлений Мангистауской области"><div className="sea-label">КАСПИЙСКОЕ МОРЕ</div><div className="map-land"/><svg viewBox="0 0 700 380" preserveAspectRatio="none" aria-hidden="true"><path className="route-path main" d="M180 203 C240 220 290 280 380 287"/><path className="route-path" d="M180 203 C290 150 410 120 580 100"/><path className="route-path" d="M180 203 C260 175 325 170 390 166"/><path className="route-path faint" d="M180 203 C145 120 125 85 110 57"/></svg><div className="map-point aktau" data-label="Актау"><i/></div><div className="map-point zhanaozen" data-label="Жанаозен"><i/></div><div className="map-point beineu" data-label="Бейнеу"><i/></div><div className="map-point shetpe" data-label="Шетпе"><i/></div><div className="map-point fort" data-label="Форт-Шевченко"><i/></div><div className="map-note"><Icon name="pin" className="size-4"/><span>Интерактивная карта появится на следующем этапе</span></div></div></article>
      <article className="corridors-card"><div className="panel-heading"><div><p className="eyebrow">Топ направлений</p><h2>Грузовые коридоры</h2></div></div><div className="corridor-list">{liveCorridors.map((item, index) => <div className="corridor" key={item.route}><div className="corridor-info"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.route}</strong><p>{item.loads} заявок</p></div></div><div className="progress"><i style={{ width: `${item.share}%` }}/></div></div>)}{!loading && liveCorridors.length === 0 && <p className="aside-empty">Данных о грузовых коридорах пока нет.</p>}</div>{assignedOrders.length > 0 && <div className="assignments-list"><p className="eyebrow">Назначенные перевозчики</p>{assignedOrders.map((order) => <div className="assignment-row" key={order.id}><div><strong>{order.origin.name} → {order.destination.name}</strong><small>{order.status === "accepted" ? "Принят" : order.status === "in_transit" ? "В пути" : "Доставлен"}</small></div><CarrierAssignment order={order} compact/></div>)}</div>}<div className="analytics-note"><Icon name="shield" className="size-5"/><p><strong>Только операционные данные</strong><span>Профиль перевозчика в MVP локальный и не является подтверждённой учётной записью.</span></p></div></article></div>
    <article className="impact-card"><div><span className="impact-icon"><Icon name="leaf" className="size-6"/></span><div><p className="eyebrow">Эффект принятых совпадений · {source === "firestore" ? "live" : "демо-сессия"}</p><h2>{routeMatches.length ? `${routeMatches.length} обратных ${routeMatches.length === 1 ? "рейс" : "рейса"} сокращают порожний пробег` : "Принятых обратных грузов пока нет"}</h2><small>Плановая оценка: 28 л/100 км и 300 ₸/л, не телеметрия.</small></div></div><div className="impact-stats"><p><strong>{matchesLoading ? "—" : formatNumber(savedKm)}</strong><span>км сохранено</span></p><i/><p><strong>{matchesLoading ? "—" : formatNumber(fuelSaved)}</strong><span>литров топлива</span></p><i/><p><strong>{matchesLoading ? "—" : `${formatNumber(moneySaved)} ₸`}</strong><span>оценочная экономия</span></p></div></article>
  </section>;
}
