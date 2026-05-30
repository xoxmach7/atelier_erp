import type { Order, OrderDetail } from '../types/order';

export const DEMO_ORDERS: Order[] = [
  {
    id: 'demo-1',
    orderNumber: 'З-2026-001',
    customerName: 'Алиева Светлана',
    customerPhone: '+7 701 123 45 67',
    status: 'in_work',
    totalAmount: 450000,
    paidAmount: 150000,
    dueDate: '2026-06-15',
    address: 'Алматы, пр. Назарбаева 42, кв. 15',
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
  },
  {
    id: 'demo-2',
    orderNumber: 'З-2026-002',
    customerName: 'Иванов Пётр',
    customerPhone: '+7 707 987 65 43',
    status: 'in_production',
    totalAmount: 320000,
    paidAmount: 320000,
    dueDate: '2026-06-20',
    address: 'Алматы, ул. Абылай хана 10, кв. 3',
    createdAt: '2026-05-18T14:30:00Z',
    updatedAt: '2026-05-18T14:30:00Z',
  },
  {
    id: 'demo-3',
    orderNumber: 'З-2026-003',
    customerName: 'Ким Анна',
    customerPhone: '+7 747 555 33 22',
    status: 'installation',
    totalAmount: 580000,
    paidAmount: 400000,
    dueDate: '2026-05-28',
    address: 'Алматы, мкр. Самал, д. 7, кв. 12',
    createdAt: '2026-05-10T09:00:00Z',
    updatedAt: '2026-05-10T09:00:00Z',
  },
  {
    id: 'demo-4',
    orderNumber: 'З-2026-004',
    customerName: 'Нурбеков Данияр',
    customerPhone: '+7 775 111 22 33',
    status: 'waiting_final_payment',
    totalAmount: 210000,
    paidAmount: 100000,
    dueDate: '2026-06-01',
    address: 'Алматы, пр. Аль-Фараби 77, оф. 405',
    createdAt: '2026-05-25T16:00:00Z',
    updatedAt: '2026-05-25T16:00:00Z',
  },
  {
    id: 'demo-5',
    orderNumber: 'З-2026-005',
    customerName: 'Бекжанова Гульнар',
    customerPhone: '+7 701 777 88 99',
    status: 'completed',
    totalAmount: 175000,
    paidAmount: 175000,
    dueDate: '2026-05-15',
    address: 'Алматы, ул. Толе би 25, кв. 8',
    createdAt: '2026-05-01T11:00:00Z',
    updatedAt: '2026-05-15T14:00:00Z',
  },
];

const DEMO_ORDER_DETAILS: Record<string, OrderDetail> = {
  'demo-1': {
    ...DEMO_ORDERS[0],
    items: [
      { id: 'i1', type: 'fabric', name: 'Велюр серый', quantity: 5.2, unitPrice: 18000, totalPrice: 93600, room: 'Гостиная', window: 'Балконная', sewingType: 'Классические шторы' },
      { id: 'i2', type: 'tulle', name: 'Органза белая', quantity: 5.2, unitPrice: 8000, totalPrice: 41600, room: 'Гостиная', window: 'Балконная' },
      { id: 'i3', type: 'cornice', name: 'Профильный карниз 3.5м', quantity: 1, unitPrice: 25000, totalPrice: 25000, room: 'Гостиная' },
      { id: 'i4', type: 'service', name: 'Монтаж', quantity: 1, unitPrice: 15000, totalPrice: 15000 },
    ],
    measurements: [
      { id: 'm1', room: 'Гостиная', window: 'Балконная', widthCm: 350, heightCm: 280, fabricName: 'Велюр серый', tulleName: 'Органза белая', fabricMeters: 5.2, tulleMeters: 5.2, foldsCount: 2 },
    ],
    payments: [
      { id: 'p1', amount: 150000, type: 'prepayment', method: 'transfer', receivedAt: '2026-05-20T10:30:00Z' },
    ],
    photoReportStatus: 'pending',
    avrStatus: 'pending',
    notes: 'Клиент просил утеплённый подклад',
  },
  'demo-2': {
    ...DEMO_ORDERS[1],
    items: [
      { id: 'i1', type: 'fabric', name: 'Лён натуральный беж', quantity: 3.8, unitPrice: 15000, totalPrice: 57000, room: 'Спальня', window: 'Окно 1', sewingType: 'Римские шторы' },
      { id: 'i2', type: 'tulle', name: 'Шифон кремовый', quantity: 3.8, unitPrice: 6000, totalPrice: 22800, room: 'Спальня', window: 'Окно 1' },
      { id: 'i3', type: 'cornice', name: 'Круглый карниз 2.8м', quantity: 1, unitPrice: 18000, totalPrice: 18000, room: 'Спальня' },
      { id: 'i4', type: 'service', name: 'Монтаж и гарантия', quantity: 1, unitPrice: 12000, totalPrice: 12000 },
    ],
    measurements: [
      { id: 'm1', room: 'Спальня', window: 'Окно 1', widthCm: 280, heightCm: 220, fabricName: 'Лён натуральный беж', tulleName: 'Шифон кремовый', fabricMeters: 3.8, tulleMeters: 3.8, foldsCount: 3 },
    ],
    payments: [
      { id: 'p1', amount: 160000, type: 'prepayment', method: 'cash', receivedAt: '2026-05-18T14:45:00Z' },
      { id: 'p2', amount: 160000, type: 'final', method: 'transfer', receivedAt: '2026-05-19T10:00:00Z' },
    ],
    photoReportStatus: 'done',
    avrStatus: 'signed',
    notes: 'Полная предоплата. Без срочности.',
  },
  'demo-3': {
    ...DEMO_ORDERS[2],
    items: [
      { id: 'i1', type: 'fabric', name: 'Блэкаут синий', quantity: 8.0, unitPrice: 22000, totalPrice: 176000, room: 'Гостиная', window: 'Панорамное' },
      { id: 'i2', type: 'tulle', name: 'Сетка серебристая', quantity: 8.0, unitPrice: 5000, totalPrice: 40000, room: 'Гостиная', window: 'Панорамное' },
      { id: 'i3', type: 'cornice', name: 'Электрокарниз Somfy', quantity: 1, unitPrice: 85000, totalPrice: 85000, room: 'Гостиная' },
      { id: 'i4', type: 'service', name: 'Монтаж электрокарниза', quantity: 1, unitPrice: 25000, totalPrice: 25000 },
      { id: 'i5', type: 'service', name: 'Настройка автоматики', quantity: 1, unitPrice: 15000, totalPrice: 15000 },
    ],
    measurements: [
      { id: 'm1', room: 'Гостиная', window: 'Панорамное', widthCm: 500, heightCm: 300, fabricName: 'Блэкаут синий', tulleName: 'Сетка серебристая', fabricMeters: 8.0, tulleMeters: 8.0, foldsCount: 2 },
    ],
    payments: [
      { id: 'p1', amount: 300000, type: 'prepayment', method: 'transfer', receivedAt: '2026-05-10T09:30:00Z' },
      { id: 'p2', amount: 100000, type: 'additional', method: 'card', receivedAt: '2026-05-22T16:00:00Z' },
    ],
    photoReportStatus: 'pending',
    avrStatus: 'draft',
    notes: 'Срочный заказ. Электрокарниз Somfy — 2 недели доставка.',
  },
  'demo-4': {
    ...DEMO_ORDERS[3],
    items: [
      { id: 'i1', type: 'fabric', name: 'Жаккард золотой', quantity: 2.5, unitPrice: 25000, totalPrice: 62500, room: 'Кабинет', window: 'Окно' },
      { id: 'i2', type: 'service', name: 'Монтаж', quantity: 1, unitPrice: 10000, totalPrice: 10000 },
    ],
    measurements: [
      { id: 'm1', room: 'Кабинет', window: 'Окно', widthCm: 200, heightCm: 180, fabricName: 'Жаккард золотой', fabricMeters: 2.5, foldsCount: 2 },
    ],
    payments: [
      { id: 'p1', amount: 100000, type: 'prepayment', method: 'transfer', receivedAt: '2026-05-25T16:30:00Z' },
    ],
    photoReportStatus: 'not_required',
    avrStatus: 'pending',
    notes: 'Офисный заказ. Требуется остаток 110 000 после подписания АВР.',
  },
  'demo-5': {
    ...DEMO_ORDERS[4],
    items: [
      { id: 'i1', type: 'fabric', name: 'Хлопок мятный', quantity: 3.0, unitPrice: 12000, totalPrice: 36000, room: 'Детская', window: 'Окно' },
      { id: 'i2', type: 'tulle', name: 'Бамбуковая сетка', quantity: 3.0, unitPrice: 4000, totalPrice: 12000, room: 'Детская', window: 'Окно' },
      { id: 'i3', type: 'cornice', name: 'Пластиковый карниз 2.0м', quantity: 1, unitPrice: 8000, totalPrice: 8000, room: 'Детская' },
      { id: 'i4', type: 'service', name: 'Монтаж', quantity: 1, unitPrice: 10000, totalPrice: 10000 },
    ],
    measurements: [
      { id: 'm1', room: 'Детская', window: 'Окно', widthCm: 200, heightCm: 180, fabricName: 'Хлопок мятный', tulleName: 'Бамбуковая сетка', fabricMeters: 3.0, tulleMeters: 3.0, foldsCount: 2 },
    ],
    payments: [
      { id: 'p1', amount: 87500, type: 'prepayment', method: 'cash', receivedAt: '2026-05-01T11:30:00Z' },
      { id: 'p2', amount: 87500, type: 'final', method: 'cash', receivedAt: '2026-05-15T14:30:00Z' },
    ],
    photoReportStatus: 'done',
    avrStatus: 'signed',
    notes: 'Заказ завершён. Клиент доволен. Рекомендовал соседям.',
  },
};

export function getDemoOrderDetail(id: string): OrderDetail | null {
  return DEMO_ORDER_DETAILS[id] ?? null;
}

/** @deprecated use getDemoOrderDetail(id) instead */
export const DEMO_ORDER_DETAIL = DEMO_ORDER_DETAILS['demo-1'];
