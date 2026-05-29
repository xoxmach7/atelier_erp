export interface PaymentSummary {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  type: 'prepayment' | 'final' | 'additional';
  method: 'cash' | 'card' | 'transfer';
  status: 'pending' | 'received' | 'confirmed';
  receivedAt?: string;
}

export interface PaymentFormData {
  orderId: string;
  amount: number;
  type: 'prepayment' | 'final' | 'additional';
  method: 'cash' | 'card' | 'transfer';
  notes?: string;
}
