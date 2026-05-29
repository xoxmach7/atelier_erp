export type OrderStatus =
  | 'new'
  | 'in_work'
  | 'in_production'
  | 'ready'
  | 'installation'
  | 'completed'
  | 'cancelled'
  | 'waiting_final_payment';

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  totalAmount: number;
  paidAmount: number;
  dueDate?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

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
