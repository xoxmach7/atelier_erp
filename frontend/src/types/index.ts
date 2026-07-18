// ============================================================================
// Domain Types - Business Logic Layer
// ============================================================================

import type { MeasurementDTO, SourceTaskDTO } from "./measurement";
import type { SupplyMode } from "./quote";

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

/**
 * Material readiness - operational layer for order execution
 * NOT a replacement for main order status
 */
export type MaterialReadiness =
  | "not_ready"        // Не обеспечен
  | "partially_ready"  // Частично обеспечен
  | "ready";           // Обеспечен материалами

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
  /** Производное состояние с бэка: дедлайн прошёл и заказ не закрыт. */
  is_overdue?: boolean;
  created_at: string;
  designer_name?: string;
  status_display?: string;
  material_readiness?: string;
  material_readiness_label?: string;
  production_stage?: string;
  production_stage_label?: string;
  handover_stage?: string;
  handover_stage_label?: string;
  ui_badge?: { color: string; label: string };
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
 * Matches backend OrderItem model with room/window context
 */
export interface OrderItemDTO {
  id: string;
  item_type: string;
  notes: string;
  // Room/window context for production clarity
  room_name?: string;
  window_name?: string;
  fabric?: string | null;  // May be UUID or object reference
  fabric_name?: string | null;  // Human-readable fabric name
  cornice?: string | null;
  service: string | null;
  unit_price: string;
  quantity: number;
  total_price: string;
  sewing_type?: string;
  window_width_cm?: number | null;
  window_height_cm?: number | null;
  folds_count?: number | null;
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
  created_at?: string | null;
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
  material_readiness: MaterialReadiness; // Operational layer: material availability for production
  production_stage?: string | null;
  handover_stage?: string | null;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  measurement_date: string | null;
  planned_completion: string | null;
  /** Производное состояние с бэка: дедлайн прошёл и заказ не закрыт. */
  is_overdue?: boolean;
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

  // Stage timestamps (set by backend when stage changes)
  materials_ready_at?: string | null;
  production_started_at?: string | null;
  production_done_at?: string | null;
  handover_done_at?: string | null;
  cancel_reason?: string;
  cancelled_at?: string | null;

  // Computed fields from serializer
  designer_name?: string;
  ui_badge?: { color: string; label: string };
}

/**
 * Order creation payload - matches backend OrderCreateSerializer
 * Backend fields: customer_id, items, installation_address_*, measurement_date, planned_completion, notes
 */
export interface OrderCreateDTO {
  customer_id: string;
  /** Свой номер заказа. Пусто/не передан — присвоит сервер (О-ГГГГ-NNN). */
  order_number?: string;
  items?: Array<{
    item_type?: string;
    description?: string;
    fabric?: string;
    fabric_meters?: number;
    cornice?: string;
    cornice_count?: number;
    service?: string;
    unit_price?: string;
    quantity?: number;
  }>;
  // Installation address fields
  installation_address_city?: string;
  installation_address_street?: string;
  installation_address_building?: string;
  installation_address_apartment?: string;
  installation_address_notes?: string;
  // Dates
  measurement_date?: string | null;
  planned_completion?: string | null;
  // Notes
  notes?: string;
  // Responsible user
  responsible_user_id?: number;
}

/**
 * Order update payload - matches backend OrderUpdateSerializer
 * Backend fields: client_name, client_phone, address, deadline, comment,
 * installation_address_*, notes, planned_completion
 */
export interface OrderUpdateDTO {
  client_name?: string;
  client_phone?: string;
  address?: string;
  deadline?: string | null;
  comment?: string;
  installation_address_city?: string;
  installation_address_street?: string;
  installation_address_building?: string;
  installation_address_apartment?: string;
  installation_address_notes?: string;
  notes?: string;
  planned_completion?: string | null;
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
// Inventory Item DTOs - общий склад (ткань/тюль/карниз/фурнитура/прочее)
// ============================================================================

export type InventoryCategory = "fabric" | "tulle" | "cornice" | "accessory" | "other";
export type InventoryUnit = "m" | "pcs" | "pack";

export interface InventoryItemDTO {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  category_display: string;
  unit: InventoryUnit;
  unit_display: string;
  quantity: string; // Decimal as string
  price_per_unit: string;
  low_stock_threshold: string;
  supplier: string;
  note: string;
  is_low_stock: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemCreateInput {
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  quantity: string | number;
  price_per_unit: string | number;
  low_stock_threshold?: string | number;
  sku?: string;
  supplier?: string;
  note?: string;
}

// ============================================================================
// Payment DTOs - API Response Types
// ============================================================================

// ============================================================================
// Estimate Types - Frontend Domain Types (Sprint 6 MVP)
// ============================================================================

/**
 * Material supply mode - how fabric will be sourced
 */
export type EstimateSupplyMode = 'in_stock' | 'purchase_local' | 'purchase_import' | 'client_supplied';

/**
 * Estimate item - single window/position in a room
 * Phase 2: One EstimateItem = One QuoteItem with full component support
 */
export interface EstimateItem {
  id: string;
  // Room context (passed from parent room)
  window_name: string; // e.g., "Окно 1", "Дверь", "Балкон"
  // Dimensions
  width_cm: number;
  height_cm: number;
  // Main fabric (curtain / портьера)
  curtain_fabric_id: string | null;
  curtain_fabric_meters: number;
  curtain_supply_mode: EstimateSupplyMode;
  // Tulle fabric (тюль) - now part of same QuoteItem
  tulle_fabric_id: string | null;
  tulle_fabric_meters: number;
  tulle_supply_mode: EstimateSupplyMode;
  // Sewing
  folds_count: number;
  sewing_type: string; // "standard" | "european" | "simple"
  complexity: string; // "simple" | "medium" | "complex" | "premium"
  sewing_cost: number;
  // Cornice
  cornice_length_m: number;
  cornice_price_per_meter: number;  // Frontend-only for calculation
  cornice_cost: number;  // Computed: length × price_per_meter
  // Additional costs
  installation_price: number;
  accessories_cost: number;
  additional_services_total: number;
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

// ============================================================================
// Order Execution DTOs - API Response Types
// GET /api/v1/orders/{id}/execution/
// ============================================================================

/**
 * Available action from backend
 */
export interface AvailableActionDTO {
  action: string;
  label: string;
  target_status?: string;
  disabled_reason?: string | null;
  requires_confirmation?: boolean;
}

/**
 * Warning or blocker item
 */
export interface WarningDTO {
  type: string;
  message: string;
  severity?: 'warning' | 'error' | 'info';
}

/**
 * Next step recommendation
 */
export interface NextStepDTO {
  description: string;
  recommended_actions: string[];
}

/**
 * Customer summary from execution endpoint
 */
export interface ExecutionCustomerDTO {
  id: string;
  full_name: string;
  phone: string;
  address?: {
    city?: string;
    street?: string;
    building?: string;
    apartment?: string;
  };
}

/**
 * Designer/Measurer measurement from execution endpoint
 * Phase 3: Includes curtain and tulle fabrics with meters
 */
export interface DesignerMeasurementDTO {
  id: string;
  room_name: string;
  window_name: string;
  width_cm: number;
  height_cm: number;
  mounting_type?: string;
  // Extended fields
  depth_cm?: number | null;
  // Phase 3: Curtain and tulle fabrics with meters
  curtain_fabric?: string | null;
  curtain_fabric_name?: string | null;
  curtain_meters?: number;
  tulle_fabric?: string | null;
  tulle_fabric_name?: string | null;
  tulle_meters?: number;
  // Legacy fields
  selected_fabric?: string | null;
  notes?: string;
}

/**
 * Selected material from quote items
 */
export interface SelectedMaterialDTO {
  room?: string | null;
  // Phase 3: Curtain and tulle fabrics with meters
  fabric?: string | null;  // Main curtain fabric
  fabric_meters?: number | string | null;
  tulle_fabric?: string | null;
  tulle_meters?: number | string | null;
  sewing_type?: string | null;
  supply_mode?: string | null;
}

/**
 * Material requirement from warehouse section
 */
export interface MaterialRequirementDTO {
  type?: string | null;
  name?: string | null;
  hanger_number?: string | null;
  required_meters?: number | string | null;
  supply_mode?: string | null;
  in_stock?: boolean | null;
  room_name?: string | null;
  window_name?: string | null;
}

/**
 * Role-specific sections
 */
export interface RoleSectionsDTO {
  admin: {
    customer: ExecutionCustomerDTO;
    order_status: string;
    payment_summary: {
      total_amount: string;
      paid_amount: string;
      balance_due: string;
      payment_state: string;
    };
    quote_status: string | null;
    measurement_count: number;
    production_status: {
      production_stage: string;
      production_stage_label: string;
    };
    material_readiness: string;
    handover_install_status: string;
    next_step: NextStepDTO;
  };
  designer: {
    measurements: DesignerMeasurementDTO[];
    rooms_count: number;
    windows_count: number;
    selected_materials: SelectedMaterialDTO[];
    quote_items_count: number;
  };
  warehouse: {
    material_requirements: MaterialRequirementDTO[];
    material_readiness: string;
    material_readiness_label: string;
    missing_materials: MaterialRequirementDTO[];
    missing_materials_count: number;
    total_fabrics_required: number;
  };
  production: {
    production_assignment: ProductionAssignmentDTO | null;
    items_to_sew: ProductionItemDTO[];
    items_count: number;
    production_stage: string;
    deadline: string | null;
  };
  installer: {
    address: {
      city?: string;
      street?: string;
      building?: string;
      apartment?: string;
      notes?: string;
    } | null;
    customer: {
      id: string;
      name: string;
      phone: string;
    };
    order_items: Array<{
      id: string;
      room_name: string | null;
      window_name: string | null;
      description: string | null;
      fabric: string | null;
      quantity: number;
      width_cm: number | null;
      height_cm: number | null;
    }>;
    items_count: number;
    installation_date: string | null;
    handover_stage: string;
    handover_stage_label: string;
    balance_due: number;
    payment_state: 'paid' | 'partial' | 'unpaid';
    warnings: WarningDTO[];
    photo_report_status: 'not_available' | 'not_uploaded' | 'uploaded';
    photo_report_count?: number;
    photo_reports?: PhotoReportSummaryDTO[];
    completion_act_status: CompletionActStatus;
    completion_act_available: boolean;
    completion_act?: CompletionActSummaryDTO;
  };
}

/**
 * Photo report summary DTO for execution summary
 */
export interface PhotoReportSummaryDTO {
  id: string;
  file_url?: string;
  caption?: string;
  uploaded_at: string;
  uploaded_by_name?: string | null;
}

/**
 * Order execution summary DTO
 * GET /api/v1/orders/{id}/execution/
 */
export interface OrderExecutionDTO {
  order_id: string;
  order_number: string;
  customer: ExecutionCustomerDTO;
  status: OrderStatus;
  status_label: string;
  material_readiness: MaterialReadiness;
  material_readiness_label: string;
  production_stage: string;
  production_stage_label: string;
  handover_stage: string;
  handover_stage_label: string;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  payment_state: 'unpaid' | 'prepayment_due' | 'partial' | 'paid';
  payment_state_label: string;
  is_overdue: boolean;
  next_step: NextStepDTO;
  blocking_reasons: WarningDTO[];
  warnings: WarningDTO[];
  available_actions: AvailableActionDTO[];
  role_sections: RoleSectionsDTO;
}

// ============================================================================
// Order Action Request/Response Types
// ============================================================================

export interface ChangeStatusRequest {
  status: OrderStatus;
}

export interface ChangeMaterialReadinessRequest {
  material_readiness: MaterialReadiness;
}

/**
 * Production item (what to sew)
 */
export interface ProductionItemDTO {
  id: string;
  room_name?: string | null;
  window_name?: string | null;
  description?: string | null;
  fabric_name?: string | null;
  tulle_name?: string | null;
  fabric_meters?: number | string | null;
  width_cm?: number | null;
  height_cm?: number | null;
  notes?: string | null;
  quantity?: number | null;
  sewing_type?: string | null;
  status?: string | null;
}

/**
 * Production assignment info
 */
export interface ProductionAssignmentDTO {
  assigned_to?: string | null;
  seamstress_name?: string | null;
  status?: string | null;
  deadline?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  total_payment?: number | string | null;
}

export interface ChangeProductionStageRequest {
  production_stage: 'not_started' | 'cutting' | 'sewing' | 'quality_check' | 'done' | string;
}

export interface ChangeHandoverStageRequest {
  handover_stage: 'not_required' | 'pending' | 'scheduled' | 'in_progress' | 'done';
}

export interface CancelOrderRequest {
  reason: string;
}

export interface ActionResponse {
  order: OrderDetailDTO;
  message?: string;
  warnings?: WarningDTO[];
  can_auto_complete?: boolean;
}

export interface ActionErrorResponse {
  detail: string;
  code: string;
  balance_due?: string;
  allowed_transitions?: string[];
}

/**
 * Photo report status for execution summary
 */
export type PhotoReportStatus = 'not_available' | 'not_uploaded' | 'uploaded';

/**
 * Photo report DTO
 */
export interface PhotoReportDTO {
  id: string;
  order: string;
  order_item?: string | null;
  file?: string;
  file_url?: string;
  caption?: string;
  uploaded_by?: string | null;
  uploaded_by_name?: string | null;
  created_at: string;
  is_active: boolean;
}

/**
 * Photo report list response
 */
export interface PhotoReportListDTO {
  count: number;
  photo_reports: PhotoReportDTO[];
}

/**
 * Photo report upload request
 */
export interface PhotoReportUploadRequest {
  file: File;
  caption?: string;
  order_item?: string | null;
}

// ============================================================================
// Order Completion Act (АВР) Types
// ============================================================================

/**
 * Completion act status
 */
export type CompletionActStatus =
  | 'not_available'
  | 'not_created'
  | 'draft'
  | 'signed';

/**
 * Order completion act (АВР) DTO
 */
export interface OrderCompletionActDTO {
  id: string;
  order: string;
  act_number: string;
  status: 'draft' | 'signed';
  status_label: string;
  signed_file?: string | null;
  signed_file_url?: string | null;
  signed_file_uploaded_by?: string | null;
  signed_file_uploaded_by_name?: string | null;
  signed_at?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Completion act summary in installer section
 */
export interface CompletionActSummaryDTO {
  id: string;
  act_number: string;
  status: 'draft' | 'signed';
  status_label: string;
  signed_file_url?: string | null;
  signed_at?: string | null;
  signed_file_uploaded_by_name?: string | null;
  notes?: string;
}

/**
 * Completion act response (GET endpoint)
 */
export interface CompletionActResponse {
  exists: boolean;
  status: CompletionActStatus;
  message?: string;
  act?: OrderCompletionActDTO;
}

/**
 * Completion act upload request
 */
export interface CompletionActUploadRequest {
  signed_file: File;
  notes?: string;
}