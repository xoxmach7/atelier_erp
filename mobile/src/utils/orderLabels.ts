import type { OrderStatus } from '../types/order';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  in_work: 'В работе',
  in_production: 'В производстве',
  ready: 'Готов',
  on_installation: 'Установка',
  waiting_final_payment: 'Ожидает оплаты',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

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
  const s = (status ?? '').toLowerCase();
  if (s === 'cancelled') return { variant: 'danger', label: 'Отменён' };
  if (isOverdue) return { variant: 'danger', label: 'Просрочен' };
  if (s === 'completed') return { variant: 'neutral', label: 'Завершён' };
  if (s === 'ready' || s === 'on_installation') return { variant: 'success', label: getStatusLabel(s) };
  if (s === 'waiting_final_payment') return { variant: 'warning', label: 'Ожидает оплаты' };
  if (s === 'in_production') return { variant: 'primary', label: 'В производстве' };
  if (s === 'in_work') return { variant: 'primary', label: 'В работе' };
  return { variant: 'neutral', label: getStatusLabel(s) };
}
