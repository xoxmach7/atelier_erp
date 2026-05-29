import { get } from "./client";

export interface WorkMaterialItem {
  id: string;
  room_name: string;
  window_name: string;
  product_type: string;
  width_cm: number | null;
  height_cm: number | null;
  fabric_name: string;
  fabric_meters: string;
  tulle_name: string;
  tulle_meters: string;
  notes: string;
}

export interface WorkOrderTask {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  installation_address: string;
  status: string;
  status_label: string;
  planned_completion_date: string | null;
  measurement_date: string | null;
  installation_date: string | null;
  material_readiness: string;
  material_readiness_label: string;
  production_stage: string;
  production_stage_label: string;
  handover_stage: string;
  handover_stage_label: string;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  payment_state: string;
  order_url: string;
}

export interface ProductionTask extends WorkOrderTask {
  items_to_sew: WorkMaterialItem[];
  actions: {
    can_start_sewing: boolean;
    can_mark_done: boolean;
  };
}

export interface InstallationTask extends WorkOrderTask {
  items_to_install: WorkMaterialItem[];
  photo_report_status: string;
  photo_report_count: number;
  completion_act_status: string;
  signed_act_uploaded: boolean;
}

export interface WarehouseTask extends WorkOrderTask {
  selected_materials: WorkMaterialItem[];
}

export interface DesignerTask extends WorkOrderTask {
  measurement_summary: WorkMaterialItem[];
  measurements_url: string;
  estimate_url: string;
}

export interface QuoteTask {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  status_label: string;
  total: string;
  items_count: number;
  order_id: string | null;
  order_url: string;
  quote_url: string;
}

export interface FabricStockItem {
  id: string;
  hanger_number: string;
  name: string;
  stock_meters: string;
  reserved_meters: string;
  available_meters: string;
  color: string;
  location: string;
}

export interface PaymentTask {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  amount: string;
  payment_type: string;
  payment_method: string;
  received_at: string | null;
}

export interface ProductionQueue {
  ready_to_start: ProductionTask[];
  in_sewing: ProductionTask[];
  done: ProductionTask[];
}

export interface InstallationQueue {
  ready_for_installation: InstallationTask[];
  in_installation: InstallationTask[];
  needs_photo_or_avr: InstallationTask[];
  waiting_final_payment: InstallationTask[];
}

export interface WarehouseQueue {
  needs_check: WarehouseTask[];
  not_ready: WarehouseTask[];
  partially_ready: WarehouseTask[];
  ready: WarehouseTask[];
  fabrics: FabricStockItem[];
}

export interface DesignerQueue {
  needs_measurement: DesignerTask[];
  measurement_done_needs_quote: DesignerTask[];
  quote_in_progress: DesignerTask[];
  overdue: DesignerTask[];
}

export interface QuotesQueue {
  ready_for_quote: DesignerTask[];
  draft_quotes: QuoteTask[];
  pending_approval: QuoteTask[];
  accepted_quotes: QuoteTask[];
}

export interface OwnerQueue {
  counters: {
    new_orders: number;
    needs_measurement: number;
    needs_quote: number;
    materials_not_ready: number;
    in_sewing: number;
    on_installation: number;
    waiting_payment: number;
    paid_needs_completion: number;
    overdue: number;
  };
  new_orders: WorkOrderTask[];
  needs_measurement: WorkOrderTask[];
  needs_quote: WorkOrderTask[];
  materials_not_ready: WorkOrderTask[];
  in_sewing: WorkOrderTask[];
  on_installation: WorkOrderTask[];
  waiting_payment: WorkOrderTask[];
  paid_needs_completion: WorkOrderTask[];
  overdue: WorkOrderTask[];
}

export interface FinanceQueue {
  waiting_payment: WorkOrderTask[];
  paid_needs_completion: WorkOrderTask[];
  recent_payments: PaymentTask[];
}

export function fetchOwnerQueue() {
  return get<OwnerQueue>("/v1/work/owner/");
}

export function fetchDesignerQueue() {
  return get<DesignerQueue>("/v1/work/designer/");
}

export function fetchQuotesQueue() {
  return get<QuotesQueue>("/v1/work/quotes/");
}

export function fetchWarehouseQueue() {
  return get<WarehouseQueue>("/v1/work/warehouse/");
}

export function fetchProductionQueue() {
  return get<ProductionQueue>("/v1/work/production/");
}

export function fetchInstallationQueue() {
  return get<InstallationQueue>("/v1/work/installation/");
}

export function fetchFinanceQueue() {
  return get<FinanceQueue>("/v1/work/finance/");
}
