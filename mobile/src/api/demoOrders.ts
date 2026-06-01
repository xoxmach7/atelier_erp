import type { Order, OrderDetail } from '../types/order';

export const DEMO_ORDERS: Order[] = [
  { id: 'demo-1', order_number: 'З-2026-001', customer: 'uuid-1', customer_name: 'Алиева Светлана', customer_phone: '+7 701 123 45 67', status: 'in_work', status_display: 'В работе', total_amount: '450000.00', paid_amount: '150000.00', balance_due: '300000.00', created_at: '2026-05-20T10:00:00Z', planned_completion: '2026-06-15' },
  { id: 'demo-2', order_number: 'З-2026-002', customer: 'uuid-2', customer_name: 'Иванов Пётр', customer_phone: '+7 707 987 65 43', status: 'waiting_final_payment', status_display: 'Ожидает оплаты', total_amount: '320000.00', paid_amount: '160000.00', balance_due: '160000.00', created_at: '2026-05-18T14:30:00Z', planned_completion: '2026-06-20' },
  { id: 'demo-3', order_number: 'З-2026-003', customer: 'uuid-3', customer_name: 'Сейткалиев Марат', customer_phone: '+7 705 111 22 33', status: 'in_production', status_display: 'В производстве', total_amount: '280000.00', paid_amount: '140000.00', balance_due: '140000.00', created_at: '2026-05-15T09:00:00Z', planned_completion: '2026-06-10' },
  { id: 'demo-4', order_number: 'З-2026-004', customer: 'uuid-4', customer_name: 'Жакупова Айгуль', customer_phone: '+7 701 555 66 77', status: 'on_installation', status_display: 'На установке', total_amount: '520000.00', paid_amount: '260000.00', balance_due: '260000.00', created_at: '2026-05-10T11:00:00Z', planned_completion: '2026-06-05' },
  { id: 'demo-5', order_number: 'З-2026-005', customer: 'uuid-5', customer_name: 'Садыков Нурлан', customer_phone: '+7 777 333 44 55', status: 'new', status_display: 'Новый', total_amount: '0.00', paid_amount: '0.00', balance_due: '0.00', created_at: '2026-06-01T08:00:00Z', planned_completion: null },
];

export function getDemoOrderDetail(id: string): OrderDetail | null {
  const order = DEMO_ORDERS.find(o => o.id === id);
  if (!order) return null;
  return { ...order, items: [], measurements: [], payments: [] };
}
