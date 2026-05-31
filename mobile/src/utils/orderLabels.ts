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
