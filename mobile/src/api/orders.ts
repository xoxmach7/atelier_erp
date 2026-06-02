import { apiClient } from './client';
import type { Order, OrdersPage } from '../types/order';

export interface CreateOrderPayload {
  client_name: string;
  client_phone: string;
  address: string;
  deadline: string;
  comment?: string;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  return apiClient.post<Order>('/api/v1/orders/', payload);
}

export async function updateOrder(id: string, payload: Partial<CreateOrderPayload>): Promise<Order> {
  return apiClient.patch<Order>(`/api/v1/orders/${id}/`, payload);
}

export async function fetchOrders(status?: string, page = 1): Promise<OrdersPage> {
  let endpoint = `/api/v1/orders/?page=${page}&page_size=50`;
  if (status) endpoint += `&status=${status}`;
  return apiClient.get<OrdersPage>(endpoint);
}

export async function fetchOrderExecution(id: string): Promise<OrderExecution> {
  return apiClient.get<OrderExecution>(`/api/v1/orders/${id}/execution/`);
}

export async function changeOrderStatus(id: string, newStatus: string): Promise<unknown> {
  return apiClient.post(`/api/v1/orders/${id}/change-status/`, { status: newStatus });
}

export async function changeMaterialReadiness(id: string, readiness: string): Promise<unknown> {
  return apiClient.post(`/api/v1/orders/${id}/change-material-readiness/`, { material_readiness: readiness });
}

export async function changeProductionStage(id: string, stage: string): Promise<unknown> {
  return apiClient.post(`/api/v1/orders/${id}/change-production-stage/`, { production_stage: stage });
}

export async function changeHandoverStage(id: string, stage: string): Promise<unknown> {
  return apiClient.post(`/api/v1/orders/${id}/change-handover-stage/`, { handover_stage: stage });
}

export async function cancelOrder(id: string, reason: string): Promise<unknown> {
  return apiClient.post(`/api/v1/orders/${id}/cancel/`, { reason });
}

export interface MeasurementPayload {
  room_name: string;
  window_number?: string;
  width: number | string;
  height: number | string;
  fabric_type?: 'curtain' | 'tulle' | '';
  fabric_meters?: number | string;
  fabric_name?: string;
  mounting_type?: string;
  comment?: string;
}

export interface MeasurementsList {
  count: number;
  results: Array<{
    id: string;
    room_name: string;
    window_name: string;
    width_cm: number;
    height_cm: number;
    mounting_type?: string;
    curtain_fabric?: string | null;
    curtain_meters?: string;
    tulle_fabric?: string | null;
    tulle_meters?: string;
    notes?: string;
    measured_at?: string;
  }>;
}

export async function fetchMeasurements(orderId: string): Promise<MeasurementsList> {
  return apiClient.get<MeasurementsList>(`/api/v1/orders/${orderId}/measurements/`);
}

export async function createMeasurement(orderId: string, payload: MeasurementPayload): Promise<unknown> {
  return apiClient.post(`/api/v1/orders/${orderId}/measurements/`, payload);
}

export interface QuoteItemPayload {
  room_name: string;
  window_name?: string;
  window_width_cm: number;
  window_height_cm: number;
  fabric_meters?: number | string;
  fabric_cost?: number | string;
  tulle_meters?: number | string;
  tulle_cost?: number | string;
  sewing_cost?: number | string;
  installation_price?: number | string;
  accessories_cost?: number | string;
  line_total: number | string;
}

export interface CreateQuotePayload {
  order_id: string;
  valid_until?: string;
  discount_amount?: number | string;
  installation_cost?: number | string;
  delivery_cost?: number | string;
  prepayment_percent?: number | string;
  items: QuoteItemPayload[];
}

export interface QuoteDTO {
  id: string;
  quote_number: string;
  status: string;
  status_label: string;
  customer_name: string;
  customer_phone: string;
  order: string;
  order_number: string;
  subtotal: string;
  discount_amount: string;
  installation_cost: string;
  delivery_cost: string;
  total: string;
  prepayment_percent: string;
  valid_until: string | null;
  pdf_generated: boolean;
  pdf_url: string;
  items: Array<{
    id: string;
    room_name: string;
    window_name: string;
    window_width_cm: number;
    window_height_cm: number;
    fabric_meters: string;
    fabric_cost: string;
    tulle_meters: string;
    tulle_cost: string;
    sewing_cost: string;
    installation_price: string;
    accessories_cost: string;
    line_total: string;
  }>;
  created_at: string;
}

export interface QuotesList {
  count: number;
  results: QuoteDTO[];
}

export async function fetchQuotes(orderId: string): Promise<QuotesList> {
  return apiClient.get<QuotesList>(`/api/v1/quotes/?order=${orderId}`);
}

export async function createQuote(payload: CreateQuotePayload): Promise<QuoteDTO> {
  return apiClient.post<QuoteDTO>('/api/v1/quotes/', payload);
}

export async function generateQuotePdf(quoteId: string): Promise<{ pdf_url: string; pdf_generated: boolean; path: string }> {
  return apiClient.post<{ pdf_url: string; pdf_generated: boolean; path: string }>(`/api/v1/quotes/${quoteId}/generate-pdf/`, {});
}

export interface OrderMaterialDTO {
  id: string;
  order: string;
  name: string;
  material_type: string;
  quantity: string;
  unit: string;
  status: 'to_buy' | 'partial' | 'ready';
  status_display: string;
  source_quote_item: string | null;
  comment: string;
  updated_at: string;
}

export interface MaterialsList {
  count: number;
  results: OrderMaterialDTO[];
}

export async function fetchMaterials(orderId: string): Promise<MaterialsList> {
  return apiClient.get<MaterialsList>(`/api/v1/orders/${orderId}/materials/`);
}

export async function updateMaterial(
  orderId: string,
  materialId: string,
  payload: { status: string; comment?: string }
): Promise<{ material: OrderMaterialDTO; order_material_readiness: string; order_material_readiness_label: string }> {
  return apiClient.patch<{ material: OrderMaterialDTO; order_material_readiness: string; order_material_readiness_label: string }>(`/api/v1/orders/${orderId}/materials/${materialId}/`, payload);
}

export interface PhotoReportDTO {
  id: string;
  order: string;
  order_item?: string | null;
  file_url: string;
  caption: string;
  uploaded_by_name?: string;
  created_at: string;
}

export interface PhotoReportsList {
  count: number;
  photo_reports: PhotoReportDTO[];
}

export async function fetchPhotoReports(orderId: string): Promise<PhotoReportsList> {
  return apiClient.get<PhotoReportsList>(`/api/v1/orders/${orderId}/photo-reports/`);
}

export async function uploadPhotoReport(orderId: string, formData: FormData): Promise<PhotoReportDTO> {
  return apiClient.postMultipart<PhotoReportDTO>(`/api/v1/orders/${orderId}/photo-reports/`, formData);
}

export interface CompletionActResponse {
  exists: boolean;
  status: string;
  message?: string;
  act?: {
    id: string;
    order: string;
    act_number: string;
    status: string;
    status_label: string;
    signed_file_url?: string;
    signed_at?: string;
    notes: string;
    created_at: string;
  };
}

export async function fetchCompletionAct(orderId: string): Promise<CompletionActResponse> {
  return apiClient.get<CompletionActResponse>(`/api/v1/orders/${orderId}/completion-act/`);
}

export async function createCompletionAct(orderId: string): Promise<CompletionActResponse> {
  return apiClient.post<CompletionActResponse>(`/api/v1/orders/${orderId}/completion-act/`, {});
}

export async function uploadSignedAct(orderId: string, formData: FormData): Promise<{ act: CompletionActResponse['act']; created: boolean; message: string }> {
  return apiClient.postMultipart<{ act: CompletionActResponse['act']; created: boolean; message: string }>(`/api/v1/orders/${orderId}/completion-act/upload-signed/`, formData);
}

export interface CompletionChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface CompletionChecklist {
  checklist: CompletionChecklistItem[];
  can_complete: boolean;
}

export async function fetchCompletionChecklist(orderId: string): Promise<CompletionChecklist> {
  return apiClient.get<CompletionChecklist>(`/api/v1/orders/${orderId}/completion-checklist/`);
}

// Execution summary shape (partial — only what mobile needs)
export interface OrderExecution {
  order_id: string;
  order_number: string;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    address?: string | { city?: string; street?: string; building?: string; apartment?: string };
  };
  status: string;
  status_label: string;
  material_readiness: string;
  material_readiness_label: string;
  production_stage: string;
  production_stage_label: string;
  handover_stage: string;
  handover_stage_label: string;
  paid_amount: string;
  total_amount: string;
  balance_due: string;
  payment_state: string;
  payment_state_label: string;
  planned_completion?: string;
  measurement_date?: string;
  installation_date?: string;
  blockers: string[];
  warnings: string[];
  actions: {
    can_take_in_work?: boolean;
    can_start_production?: boolean;
    can_mark_ready?: boolean;
    can_start_installation?: boolean;
    can_complete?: boolean;
    can_cancel?: boolean;
    can_add_measurement?: boolean;
    can_add_quote?: boolean;
    can_add_payment?: boolean;
    can_start_cutting?: boolean;
    can_start_sewing?: boolean;
    can_mark_production_done?: boolean;
    can_schedule_installation?: boolean;
    can_mark_installed?: boolean;
    can_upload_photo?: boolean;
    next_action?: string;
    next_action_label?: string;
  };
  measurements?: Array<{
    id: string;
    room_name: string;
    window_name: string;
    curtain_fabric?: string;
    tulle_fabric?: string;
    width_cm?: number;
    height_cm?: number;
    curtain_fabric_meters?: number;
    tulle_fabric_meters?: number;
    mounting_type?: string;
    notes?: string;
  }>;
  items_to_sew?: Array<{
    id: string;
    room_name?: string;
    window_name?: string;
    curtain_fabric?: string;
    tulle_fabric?: string;
    sewing_type?: string;
    notes?: string;
  }>;
  items_to_install?: Array<{
    id: string;
    room_name?: string;
    window_name?: string;
    product_type?: string;
    notes?: string;
  }>;
  photo_report_status?: string;
  photo_report_count?: number;
  completion_act_status?: string;
  signed_act_uploaded?: boolean;
}
