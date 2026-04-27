// ============================================================================
// Domain Types - Business Logic Layer
// ============================================================================

import type { MeasurementDTO, SourceTaskDTO } from "./measurement";

// Approved MVP Order Status Model:
// Новый -> В работе -> В производстве -> Готов -> На установке/выдаче -> Ожидает финальной оплаты -> Завершён
// OR: Отменён (from any status)
export type OrderStatus =
  | "new"           // Новый
  | "in_work"       // В работе
  | "in_production" // В производстве
  | "ready"         // Готов
  | "on_installation" // На установке / выдаче
  | "waiting_final_payment" // Ожидает финальной оплаты
  | "completed"     // Завершён
  | "cancelled";    // Отменён

// TODO Sprint 3+: Review and clean up unused status types
export type TaskStatus =
  | "lead"
  | "measurement_scheduled"
  | "measurement_done"
  | "quoting"
  | "quote_sent"
  | "converted"
  | "lost"
  | "postponed";

export type PaymentStatus = "pending" | "partial" | "paid";

export type ProductionStatus =
  | "pending"
  | "cutting"
  | "sewing"
  | "finishing"
  | "quality_check"
  | "ready";

// ============================================================================
// Backend DTOs - API Response Types
// ============================================================================

/**
 * Order list item DTO - matches backend OrderListSerializer
 * Used for: GET /v1/orders/ list endpoint
 * Backend fields: id, order_number, customer, customer_name, customer_phone,
 *                 status, total_amount, paid_amount, balance_due,
 *                 measurement_date, planned_completion, created_at
 */
export interface OrderListItemDTO {
  id: string;
  order_number: string;
  customer: string;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  total_amount: string; // Decimal as string from Django
  paid_amount: string;
  balance_due: string;
  measurement_date: string | null;
  planned_completion: string | null;
  created_at: string;
}

/**
 * Customer details from OrderSerializer customer_details
 */
export interface CustomerDetailsDTO {
  id: string;
  full_name: string;
  phone: string;
  address_city: string;
  is_active: boolean;
}

/**
 * Order item from OrderSerializer items
 */
export interface OrderItemDTO {
  id: string;
  item_type: string;
  description: string;
  fabric: string | null;
  fabric_meters: string | null;
  cornice: string | null;
  cornice_count: number | null;
  service: string | null;
  unit_price: string;
  quantity: number;
  total_price: string;
}

/**
 * Payment DTO - matches backend PaymentSerializer
 */
export interface PaymentDTO {
  id: string;
  order: string;
  order_number: string;
  amount: string;
  payment_type: "prepayment" | "final" | "additional";
  payment_method: "cash" | "card" | "transfer" | "kaspi";
  external_transaction_id: string | null;
  created_by: string;
  created_by_name: string;
  notes: string | null;
  received_at: string;
  created_at: string;
}

/**
 * Source quote info when order was created from a quote
 */
export interface SourceQuoteDTO {
  id: string;
  quote_number: string;
  total: string;
  status: string;
}

/**
 * Order detail DTO - matches backend v1 OrderDetailSerializer
 * Used for: GET /v1/orders/{id}/ detail endpoint
 * Backend fields: id, order_number, customer (nested), status, items, etc.
 */
export interface OrderDetailDTO {
  // Core fields (also in OrderListItemDTO)
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  measurement_date: string | null;
  planned_completion: string | null;
  created_at: string;

  // V1 API returns customer as nested object (CustomerMinimalSerializer)
  customer: CustomerDetailsDTO | string;

  // Order items
  items: OrderItemDTO[];

  // Related workflow data
  measurements: MeasurementDTO[];
  payments: PaymentDTO[];
  source_task: SourceTaskDTO | null;
  source_quote: SourceQuoteDTO | null;
  related_quotes?: SourceQuoteDTO[];  // Quotes created from this order (direct order flow)

  // Installation address
  installation_address_city: string;
  installation_address_street: string;
  installation_address_building: string;
  installation_address_apartment: string;
  installation_address_notes: string | null;

  // Additional dates
  installation_date: string | null;
  actual_completion: string | null;

  // Notes (called 'notes' in backend, not 'description')
  notes: string | null;

  // Metadata (called 'updated_at' in backend, not 'modified_at')
  updated_at: string;
}

// ============================================================================
// Fabric DTOs - API Response Types
// ============================================================================

/**
 * Fabric DTO - matches backend FabricSerializer
 * Used for: GET /v1/fabrics/ list endpoint
 */
export interface FabricDTO {
  id: string;
  hanger_number: string;
  name: string;
  composition: string;
  width_cm: number;
  stock_meters: string; // Decimal as string from Django
  reserved_meters: string;
  available_meters: string; // Calculated field
  price_per_meter: string;
  color: string;
  pattern: string | null;
  supplier: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Payment DTOs - API Response Types
// ============================================================================

// ============================================================================
// Estimate Types - Frontend Domain Types (Sprint 6 MVP)
// ============================================================================

/**
 * Estimate item - single window/position in a room
 * NOTE: MVP uses manual meters input, no complex formula yet
 */
export interface EstimateItem {
  id: string;
  name: string; // e.g., "Window 1", "Door curtain"
  width_cm: number;
  height_cm: number;
  curtain_fabric_id: string | null;
  curtain_fabric_meters: number;
  tulle_fabric_id: string | null;
  tulle_fabric_meters: number;
}

/**
 * Room section containing multiple items
 */
export interface EstimateRoom {
  id: string;
  name: string; // e.g., "Living Room", "Bedroom"
  items: EstimateItem[];
}

/**
 * Estimate project structure
 * NOTE: MVP local-only, no backend save yet
 */
export interface EstimateProject {
  id: string;
  name: string;
  client_name: string;
  rooms: EstimateRoom[];
  created_at: Date;
}

// ============================================================================
// Measurement Types - Backend Integration Complete
// API endpoints: /api/measurements/ - CRUD via REST
// ============================================================================

export type {
  MountingType,
  CorniceType,
  InstallationComplexity,
  MeasurementItem,
  MeasurementRoom,
  MeasurementProject,
  MeasurementSummary,
  MeasurementDTO,
  MeasurementListResponse,
  SourceTaskDTO,
} from "./measurement";

// ============================================================================
// Quote (Estimate) Types - Backend Integration Complete
// API endpoints: /api/quotes/ - CRUD via REST
// ============================================================================

export type {
  QuoteStatus,
  QuoteItemDTO,
  QuoteDTO,
  QuoteListResponse,
} from "./quote";

// ============================================================================
// Frontend Domain Models - Internal Application Types
// ============================================================================

/**
 * Order domain model - frontend representation
 * TODO Sprint 3+: Transform from DTO to domain model
 */
export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}
