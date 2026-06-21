// Backend returns snake_case — these types match the API response directly
export type OrderStatus =
  | 'new'
  | 'in_work'
  | 'in_production'
  | 'ready'
  | 'on_installation'
  | 'waiting_final_payment'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  order_number: string;
  customer: string;          // UUID
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  status_display: string;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  created_at: string;
  planned_completion: string | null;
  designer_name?: string;
  material_readiness?: string;
  ui_badge?: { color: 'red' | 'yellow' | 'green' | 'gray'; label: string };
}

export interface OrdersPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Order[];
}

// Keep legacy types for OrderDetail until detail screen is rebuilt
export interface OrderDetail extends Order {
  items: OrderItem[];
  measurements?: Measurement[];
  payments?: Payment[];
  photoReportStatus?: 'pending' | 'done' | 'not_required';
  avrStatus?: 'pending' | 'draft' | 'signed';
  notes?: string;
}

export interface OrderItem {
  id: string;
  type: 'fabric' | 'tulle' | 'cornice' | 'service';
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  room?: string;
  window?: string;
  sewingType?: string;
}

export interface Measurement {
  id: string;
  room: string;
  window: string;
  widthCm?: number;
  heightCm?: number;
  fabricName?: string;
  tulleName?: string;
  fabricMeters?: number;
  tulleMeters?: number;
  foldsCount?: number;
}

export interface Payment {
  id: string;
  amount: number;
  type: 'prepayment' | 'final' | 'additional';
  method: 'cash' | 'card' | 'transfer';
  receivedAt: string;
  receivedBy?: string;
}
