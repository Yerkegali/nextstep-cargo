import { Icon } from "@/components/icons";
import { AIAnalysisPanel } from "@/components/ai-analysis-panel";
import { buildReturnRouteAnalysisRequest } from "@/lib/ai/analytics";
import { findReturnCargoMatches, planningAssumptions } from "@/lib/matching";
import type { CargoOrder, RankedRouteMatch } from "@/types/cargo";

const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
const formatPrice = (value: number) => new Intl.NumberFormat("ru-RU").format(value);

export function ReturnMatchPanel({ original, orders, busyId, onAccept, onClose }: { original: CargoOrder; orders: CargoOrder[]; busyId: string | null; onAccept: (match: RankedRouteMatch) => void; onClose: () => void }) {
  const matches = findReturnCargoMatches(original, orders);
  const best = matches[0];
  const aiRequest = buildReturnRouteAnalysisRequest(original, matches);
  return <section className="match-panel" aria-labelledby="match-panel-title">
    <div className="match-panel-head"><div><p className="eyebrow">Оптимизация обратного рейса</p><h2 id="match-panel-title">Обратный груз из {original.destination.name}</h2><p>Расчёт по справочной матрице расстояний, не по GPS.</p></div><button type="button" className="close-button" onClick={onClose} aria-label="Закрыть подбор">×</button></div>
    {!best ? <div className="no-match"><span><Icon name="search" className="size-6"/></span><div><h3>Подходящего обратного груза пока нет</h3><p>Система проверила все доступные заявки, но ни одна не сокращает пустой пробег минимум на 10%. Можно проверить позже.</p></div></div> : <>
      <div className="comparison-card"><div><span>Без обратного груза</span><strong>{best.emptyKmBefore} км</strong><small>пустыми до {original.origin.name}</small></div><div className="comparison-arrow"><Icon name="arrow" className="size-5"/></div><div><span>С NextStep</span><strong>{best.emptyKmAfter} км</strong><small>оценочный пустой пробег</small></div><div className="saving-highlight"><Icon name="leaf" className="size-5"/><p><strong>−{best.savedKm} км</strong><span>порожнего пробега</span></p></div></div>
      <div className="benefit-grid"><div><Icon name="route" className="size-5"/><p><strong>−{best.savedKm} км</strong><span>пустого пути</span></p></div><div><Icon name="fuel" className="size-5"/><p><strong>≈ {formatNumber(best.fuelSavedLiters)} л</strong><span>топлива сохранено</span></p></div><div><Icon name="chart" className="size-5"/><p><strong>≈ {formatPrice(best.estimatedSavingsKzt)} ₸</strong><span>оценочная экономия</span></p></div></div>
      <p className="assumption-note">Расчёт основан на допущении {planningAssumptions.truckFuelConsumptionLitersPer100Km} л/100 км и {planningAssumptions.fuelPriceKztPerLiter} ₸/л.</p>
      {aiRequest && <AIAnalysisPanel request={aiRequest} buttonLabel="AI-анализ" heading="Почему этот рейс выгоден?"/>}
      <div className="matches-list"><div className="matches-title"><h3>Рекомендованные грузы</h3><span>{matches.length} вариантов</span></div>{matches.map((match, index) => <article className={`match-result ${index === 0 ? "best" : ""}`} key={match.returnOrderId}>{index === 0 && <span className="best-label"><Icon name="spark" className="size-4"/> Лучшее совпадение</span>}<div className="match-result-main"><div><div className="match-route"><strong>{match.returnOrigin.name}</strong><Icon name="arrow" className="size-4"/><strong>{match.returnDestination.name}</strong></div><p>{match.returnOrder.cargoType} · {(match.returnOrder.weightKg / 1000).toLocaleString("ru-RU")} т · {formatPrice(match.returnOrder.priceKzt)} ₸</p><small>{match.reason}{match.repositionKm > 0 ? ` · ${match.repositionKm} км до погрузки` : ""}</small></div><div className="match-score"><strong>{match.matchScore}%</strong><span>совместимость</span></div></div><div className="match-result-footer"><p><strong>−{match.savedKm} км</strong><span> · ≈ {formatPrice(match.estimatedSavingsKzt)} ₸ экономии</span></p><button type="button" className="primary-button" disabled={busyId === match.returnOrderId} onClick={() => onAccept(match)}>{busyId === match.returnOrderId ? "Принимаем…" : "Взять обратный груз"}</button></div></article>)}</div>
    </>}
  </section>;
}
