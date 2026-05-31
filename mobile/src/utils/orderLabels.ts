import type { OrderStatus } from '../types/order';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  in_work: 'В работе',
  in_production: 'В производстве',
  ready: 'Готов',
  installation: 'Установка',
  waiting_final_payment: 'Ожидает оплаты',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export const NEXT_STEP_LABELS: Record<OrderStatus, string> = {
  new: 'Взять заказ в работу',
  in_work: 'Передать в производство',
  in_production: 'Завершить производство',
  ready: 'Назначить установку / выдачу',
  installation: 'Завершить установку / выдачу',
  waiting_final_payment: 'Принять финальную оплату',
  completed: 'Заказ завершён',
  cancelled: 'Заказ отменён',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status ?? 'Неизвестный статус';
}

export function getNextStepLabel(status: string): string {
  return NEXT_STEP_LABELS[status as OrderStatus] ?? 'В работе';
}

export type IndicatorVariant = 'danger' | 'warning' | 'success' | 'primary' | 'neutral';

export interface OrderIndicator {
  variant: IndicatorVariant;
  label: string;
}

/**
 * Returns a deterministic status indicator with color and label.
 * Priority: cancelled > overdue > completed > ready > material problem > payment waiting > workflow > unknown
 */
export function getOrderIndicator(
  status?: string | null,
  materialReadiness?: string | null,
  isOverdue?: boolean
): OrderIndicator {
  const s = (status ?? '').toLowerCase();

  if (s === 'cancelled') return { variant: 'danger', label: 'Отменён' };
  if (isOverdue) return { variant: 'danger', label: 'Просрочен' };
  if (s === 'completed') return { variant: 'success', label: 'Завершён' };
  if (s === 'ready') return { variant: 'success', label: 'Готов' };

  if (materialReadiness) {
    const m = materialReadiness.toLowerCase();
    if (m === 'not_ready') return { variant: 'danger', label: 'Материалы не готовы' };
    if (m === 'partially_ready') return { variant: 'warning', label: 'Материалы частично' };
  }

  if (s === 'waiting_final_payment') return { variant: 'warning', label: 'Ожидает оплаты' };
  if (s === 'installation') return { variant: 'primary', label: 'Установка' };
  if (s === 'in_production') return { variant: 'primary', label: 'В производстве' };
  if (s === 'in_work') return { variant: 'primary', label: 'В работе' };
  if (s === 'new') return { variant: 'neutral', label: 'Новый' };

  return { variant: 'neutral', label: 'Без статуса' };
}
