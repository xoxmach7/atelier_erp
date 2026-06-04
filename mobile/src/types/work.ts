export type RoleKey =
  | 'owner'
  | 'designer'
  | 'quotes'
  | 'warehouse'
  | 'production'
  | 'installation'
  | 'finance';

export interface WorkQueueItem {
  id: string;
  orderId: string;
  orderNumber: string;
  clientName: string;
  clientPhone: string;
  address: string | { city?: string; street?: string; building?: string; apartment?: string };
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  stage?: string;
  materialReadiness?: 'not_ready' | 'partially_ready' | 'ready';
  actions?: string[];
  context?: string;
  items?: WorkItem[];
  measurements?: MeasurementSummary;
}

export interface WorkItem {
  id: string;
  type: 'fabric' | 'tulle' | 'cornice' | 'service';
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  room?: string;
  window?: string;
}

export interface MeasurementSummary {
  roomCount: number;
  windowCount: number;
  totalFabricMeters: number;
  totalTulleMeters: number;
}

export interface WorkQueueResponse {
  role: RoleKey;
  count: number;
  items: WorkQueueItem[];
}
