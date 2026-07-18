import type { OrderStatus } from '../types/order';

// Должно совпадать с Order.Status на бэкенде (единый источник истины) и с
// frontend/src/components/shared/status-badge.tsx. Расхождение подписей =
// разный текст на вебе и в мобилке для одного и того же заказа.
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  in_work: 'В работе',
  in_production: 'В производстве',
  ready: 'Готов',
  on_installation: 'На установке / выдаче',
  waiting_final_payment: 'Ожидает финальной оплаты',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

/**
 * Группы статусов для фильтр-пилюль. Восемь статусов FSM слишком дробные для
 * телефона, поэтому список заказов фильтруется по группе (`?status_group=`).
 * Раскладка группа→статусы живёт на бэке в atelier_erp/api/v1/filters.py
 * (ORDER_STATUS_GROUPS) — здесь только подписи.
 * `overdue` — не статус, а производное состояние (дедлайн прошёл, заказ открыт).
 */
export const STATUS_GROUP_LABELS: Record<string, string> = {
  in_work: 'В работе',
  overdue: 'Просрочен',
  completed: 'Завершён',
  waiting: 'Ожидание',
};

/**
 * Складская формулировка поля material_readiness (обеспечение материалами).
 * Это НЕ дубль статусов заказа: другая шкала и другая аудитория —
 * склад смотрит на обеспечение, а не на стадию заказа.
 *   not_ready       — материалов нет, нужно закупить
 *   partially_ready — материалы есть, нужно собрать под заказ
 *   ready           — всё собрано
 */
export const MATERIAL_WAREHOUSE_LABELS: Record<string, string> = {
  not_ready: 'Закуп',
  partially_ready: 'Сборка',
  ready: 'Готово',
};

export const MATERIAL_WAREHOUSE_COLOR: Record<string, string> = {
  not_ready: '#EF4444',
  partially_ready: '#22C55E',
  ready: '#94A3B8',
};

export function getWarehouseLabel(readiness?: string | null): string {
  return MATERIAL_WAREHOUSE_LABELS[readiness ?? ''] ?? 'Закуп';
}

export function getWarehouseColor(readiness?: string | null): string {
  return MATERIAL_WAREHOUSE_COLOR[readiness ?? ''] ?? '#EF4444';
}

export const NEXT_STEP_LABELS: Record<OrderStatus, string> = {
  new: 'Взять в работу',
  in_work: 'Передать в производство',
  in_production: 'Завершить производство',
  ready: 'Назначить установку',
  on_installation: 'Завершить установку',
  waiting_final_payment: 'Принять финальную оплату',
  completed: 'Заказ завершён',
  cancelled: 'Заказ отменён',
};

export const STATUS_DOT_COLOR: Record<OrderStatus, string> = {
  new: '#94a3b8',
  in_work: '#60cced',
  in_production: '#3b82f6',
  ready: '#22c55e',
  on_installation: '#22c55e',
  waiting_final_payment: '#eab308',
  completed: '#d1d5db',
  cancelled: '#ef4444',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status ?? 'Неизвестный статус';
}

export function getNextStepLabel(status: string): string {
  return NEXT_STEP_LABELS[status as OrderStatus] ?? 'Открыть заказ';
}

export function getStatusDotColor(status: string): string {
  return STATUS_DOT_COLOR[status as OrderStatus] ?? '#d1d5db';
}

export type IndicatorVariant = 'danger' | 'warning' | 'success' | 'primary' | 'neutral';

export interface OrderIndicator {
  variant: IndicatorVariant;
  label: string;
}

export function getOrderIndicator(
  status?: string | null,
  _materialReadiness?: string | null,
  isOverdue?: boolean
): OrderIndicator {
  // Подписи всегда берём из STATUS_LABELS (getStatusLabel), чтобы не заводить
  // третью копию текстов. Здесь выбирается только ЦВЕТ (variant).
  // Исключение — «Просрочен»: это производное состояние, а не статус заказа.
  const s = (status ?? '').toLowerCase();
  if (s === 'cancelled') return { variant: 'danger', label: getStatusLabel(s) };
  if (isOverdue) return { variant: 'danger', label: 'Просрочен' };
  if (s === 'completed') return { variant: 'neutral', label: getStatusLabel(s) };
  if (s === 'ready' || s === 'on_installation') return { variant: 'success', label: getStatusLabel(s) };
  if (s === 'waiting_final_payment') return { variant: 'warning', label: getStatusLabel(s) };
  if (s === 'in_production' || s === 'in_work') return { variant: 'primary', label: getStatusLabel(s) };
  return { variant: 'neutral', label: getStatusLabel(s) };
}
