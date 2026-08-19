import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { useOrders } from "@/components/orders-provider";
import { mangystauLocations } from "@/data/demo";
import { getKnownRouteDistanceKm } from "@/lib/distances";
import type { CargoType } from "@/types/cargo";

const locations = Object.values(mangystauLocations);
const formatPrice = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const statusLabels = { available: "Доступен", accepted: "Принят", in_transit: "В пути", delivered: "Доставлен" } as const;

export function ShipperView() {
  const { orders, loading, error: connectionError, source, create } = useOrders();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const values = new FormData(event.currentTarget);
    const originName = String(values.get("origin"));
    const destinationName = String(values.get("destination"));
    const weightKg = Number(values.get("weightKg"));
    const priceKzt = Number(values.get("priceKzt"));
    if (!originName || !destinationName) return setFeedback({ type: "error", text: "Выберите города отправления и назначения." });
    if (originName === destinationName) return setFeedback({ type: "error", text: "Города отправления и назначения должны отличаться." });
    if (!Number.isFinite(weightKg) || weightKg <= 0) return setFeedback({ type: "error", text: "Укажите вес больше нуля." });
    if (!Number.isFinite(priceKzt) || priceKzt <= 0) return setFeedback({ type: "error", text: "Укажите цену больше нуля." });
    const origin = locations.find((item) => item.name === originName);
    const destination = locations.find((item) => item.name === destinationName);
    if (!origin || !destination) return setFeedback({ type: "error", text: "Выбран неизвестный населённый пункт." });
    setSaving(true); setFeedback(null);
    try {
      await create({ origin, destination, cargoType: String(values.get("cargoType")) as CargoType, weightKg, priceKzt, shipperName: "NextStep Demo Shipper", comment: String(values.get("comment") ?? "").trim(), distanceKm: getKnownRouteDistanceKm(originName, destinationName), pickupDate: "По договорённости" });
      formRef.current?.reset();
      setFeedback({ type: "success", text: source === "firestore" ? "Заявка опубликована в Firestore и уже доступна перевозчикам." : "Заявка создана локально в резервном демо-режиме." });
    } catch { setFeedback({ type: "error", text: "Не удалось сохранить заявку в Firestore. Проверьте подключение и правила доступа." }); }
    finally { setSaving(false); }
  }

  return <section className="view-section">
    <div className="section-heading"><div><p className="eyebrow">Кабинет отправителя</p><h1>Создать заявку</h1><p>Опишите груз — перевозчики увидят его в общей ленте.</p></div></div>
    <div className="connection-line"><span className={source === "firestore" ? "connected" : "demo"}><i/>{source === "firestore" ? "Firestore · синхронизация включена" : "Резервный демо-режим"}</span></div>
    <div className="shipper-layout">
      <form ref={formRef} className="order-form" onSubmit={handleSubmit}>
        <div className="form-intro"><div className="form-icon"><Icon name="plus" className="size-5"/></div><div><h2>Новая перевозка</h2><p>Поля со звёздочкой обязательны</p></div></div>
        <div className="form-grid">
          <label><span>Откуда *</span><select name="origin" required defaultValue=""><option value="" disabled>Выберите город</option>{locations.map(({ name }) => <option key={name}>{name}</option>)}</select></label>
          <label><span>Куда *</span><select name="destination" required defaultValue=""><option value="" disabled>Выберите город</option>{locations.map(({ name }) => <option key={name}>{name}</option>)}</select></label>
          <label><span>Тип груза *</span><select name="cargoType" required defaultValue=""><option value="" disabled>Выберите тип</option><option>Стройматериалы</option><option>Продукты</option><option>Оборудование</option><option>Запчасти</option><option>Бытовые товары</option><option>Тара и упаковка</option><option>Прочее</option></select></label>
          <label><span>Вес, кг *</span><input name="weightKg" required min="1" type="number" inputMode="decimal" placeholder="Например, 12000"/></label>
          <label className="full"><span>Цена, ₸ *</span><input name="priceKzt" required min="1" type="number" inputMode="numeric" placeholder="Например, 185000"/></label>
          <label className="full"><span>Комментарий</span><textarea name="comment" rows={3} placeholder="Условия загрузки, габариты или пожелания"/></label>
        </div>
        <div className="form-footer"><p><Icon name="shield" className="size-4"/> Расстояния — справочная демо-оценка, не GPS</p><button className="primary-button" type="submit" disabled={saving}>{saving ? <><span className="button-spinner"/>Сохраняем…</> : <>Опубликовать заявку <Icon name="arrow" className="size-4"/></>}</button></div>
        {(feedback || connectionError) && <div className={`inline-feedback ${feedback?.type === "success" && !connectionError ? "success" : "error"}`} role="status">{feedback?.type === "success" && <Icon name="check" className="size-4"/>}<span>{feedback?.text ?? connectionError}</span></div>}
      </form>
      <aside className="recent-orders"><div className="aside-title"><div><p className="eyebrow">Последние заявки</p><h2>Заявки в системе</h2></div><span>{orders.length}</span></div>{loading ? <div className="small-loading" role="status"><span className="spinner" aria-hidden="true"/> Загружаем…</div> : orders.slice(0, 8).map((order) => <article key={order.id}><div className="mini-route"><span>{order.origin.name}</span><Icon name="arrow" className="size-4"/><span>{order.destination.name}</span></div><p>{order.cargoType} · {(order.weightKg / 1000).toLocaleString("ru-RU")} т</p><div><span className={`tag ${order.status}`}>{statusLabels[order.status]}</span><strong>{formatPrice(order.priceKzt)} ₸</strong></div></article>)}{!loading && orders.length === 0 && <p className="aside-empty">Заявок пока нет.</p>}</aside>
    </div>
  </section>;
}
