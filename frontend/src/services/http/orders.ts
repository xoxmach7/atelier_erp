/**
 * Orders API Service
 * Handles all HTTP operations for orders
 */

import { get, post, patch, del } from "./client";
import type {
  OrderListItemDTO,
  OrderDetailDTO,
  OrderExecutionDTO,
  OrderCreateDTO,
  OrderUpdateDTO,
  ChangeStatusRequest,
  ChangeMaterialReadinessRequest,
  ChangeProductionStageRequest,
  ChangeHandoverStageRequest,
  CancelOrderRequest,
  ActionResponse,
  PhotoReportListDTO,
  PhotoReportDTO,
  CompletionActResponse,
  OrderCompletionActDTO,
} from "@/types";

interface OrdersListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: OrderListItemDTO[];
}

interface OrdersFilter extends Record<string, string | number | boolean | undefined> {
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

/**
 * Fetch paginated list of orders
 */
export async function fetchOrders(filters?: OrdersFilter): Promise<OrdersListResponse> {
  return get<OrdersListResponse>("/v1/orders/", {
    params: filters,
  });
}

/**
 * Fetch single order by ID
 */
export async function fetchOrderById(id: string): Promise<OrderDetailDTO> {
  return get<OrderDetailDTO>(`/v1/orders/${id}/`);
}

/**
 * Create new order
 */
export async function createOrder(data: OrderCreateDTO): Promise<OrderDetailDTO> {
  return post<OrderDetailDTO>("/v1/orders/", data);
}

/**
 * Update order
 */
export async function updateOrder(orderId: string, data: OrderUpdateDTO): Promise<OrderDetailDTO> {
  return patch<OrderDetailDTO>(`/v1/orders/${orderId}/`, data);
}

// ============================================================================
// Order Execution API - Workflow management
// ============================================================================

/**
 * Fetch order execution summary
 * GET /api/v1/orders/{id}/execution/
 */
export async function fetchOrderExecution(orderId: string): Promise<OrderExecutionDTO> {
  return get<OrderExecutionDTO>(`/v1/orders/${orderId}/execution/`);
}

/**
 * Change order status
 * POST /api/v1/orders/{id}/change-status/
 */
export async function changeOrderStatus(
  orderId: string,
  data: ChangeStatusRequest
): Promise<ActionResponse> {
  return post<ActionResponse>(`/v1/orders/${orderId}/change-status/`, data);
}

/**
 * Change material readiness
 * POST /api/v1/orders/{id}/change-material-readiness/
 */
export async function changeMaterialReadiness(
  orderId: string,
  data: ChangeMaterialReadinessRequest
): Promise<ActionResponse> {
  return post<ActionResponse>(`/v1/orders/${orderId}/change-material-readiness/`, data);
}

/**
 * Change production stage
 * POST /api/v1/orders/{id}/change-production-stage/
 */
export async function changeProductionStage(
  orderId: string,
  data: ChangeProductionStageRequest
): Promise<ActionResponse> {
  return post<ActionResponse>(`/v1/orders/${orderId}/change-production-stage/`, data);
}

/**
 * Change handover stage
 * POST /api/v1/orders/{id}/change-handover-stage/
 */
export async function changeHandoverStage(
  orderId: string,
  data: ChangeHandoverStageRequest
): Promise<ActionResponse> {
  return post<ActionResponse>(`/v1/orders/${orderId}/change-handover-stage/`, data);
}

/**
 * Send order to production (transition status → in_production)
 * POST /api/v1/orders/{id}/send-to-production/
 */
export async function sendToProduction(orderId: string): Promise<ActionResponse> {
  return post<ActionResponse>(`/v1/orders/${orderId}/send-to-production/`, {});
}

/**
 * Cancel order
 * POST /api/v1/orders/{id}/cancel/
 */
export async function cancelOrder(
  orderId: string,
  data: CancelOrderRequest
): Promise<ActionResponse> {
  return post<ActionResponse>(`/v1/orders/${orderId}/cancel/`, data);
}

/**
 * Generate OrderItems from linked Quote
 * POST /api/v1/orders/{id}/generate-items-from-quote/
 */
export async function generateOrderItemsFromQuote(
  orderId: string,
  quoteId?: string
): Promise<{ order: OrderDetailDTO; created_count: number; message: string }> {
  return post<{ order: OrderDetailDTO; created_count: number; message: string }>(
    `/v1/orders/${orderId}/generate-items-from-quote/`,
    quoteId ? { quote_id: quoteId } : {}
  );
}

/**
 * Fetch photo reports for an order
 * GET /api/v1/orders/{id}/photo-reports/
 */
export async function getOrderPhotoReports(orderId: string): Promise<PhotoReportListDTO> {
  return get<PhotoReportListDTO>(`/v1/orders/${orderId}/photo-reports/`);
}

/**
 * Upload photo report for an order
 * POST /api/v1/orders/{id}/photo-reports/
 * Uses FormData for multipart/form-data upload
 */
export async function uploadOrderPhotoReport(
  orderId: string,
  formData: FormData
): Promise<PhotoReportDTO> {
  return post<PhotoReportDTO>(`/v1/orders/${orderId}/photo-reports/`, formData);
}

// ============================================================================
// Order Completion Act (АВР) API
// ============================================================================

/**
 * Get order completion act (АВР)
 * GET /api/v1/orders/{id}/completion-act/
 */
export async function getOrderCompletionAct(
  orderId: string
): Promise<CompletionActResponse> {
  return get<CompletionActResponse>(`/v1/orders/${orderId}/completion-act/`);
}

/**
 * Create order completion act (АВР)
 * POST /api/v1/orders/{id}/completion-act/
 */
export async function createOrderCompletionAct(
  orderId: string
): Promise<CompletionActResponse> {
  return post<CompletionActResponse>(`/v1/orders/${orderId}/completion-act/`, {});
}

// ============================================================================
// Measurements API
// ============================================================================

export interface MeasurementPayload {
  room_name: string;
  window_number?: string;
  width: number;
  height: number;
  fabric_type?: 'curtain' | 'tulle';
  fabric_meters?: number;
  fabric_name?: string;
  mounting_type?: string;
  comment?: string;
}

export interface MeasurementsListResponse {
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

/**
 * Fetch measurements for an order
 * GET /api/v1/orders/{id}/measurements/
 */
export async function fetchMeasurements(orderId: string): Promise<MeasurementsListResponse> {
  return get<MeasurementsListResponse>(`/v1/orders/${orderId}/measurements/`);
}

/**
 * Create measurement for an order
 * POST /api/v1/orders/{id}/measurements/
 */
export async function createMeasurement(
  orderId: string,
  data: MeasurementPayload
): Promise<unknown> {
  return post<unknown>(`/v1/orders/${orderId}/measurements/`, data);
}

// ============================================================================
// Quotes API
// ============================================================================

export interface QuoteItemPayload {
  room_name: string;
  window_name?: string;
  window_width_cm: number;
  window_height_cm: number;
  fabric_meters?: number;
  fabric_cost?: number;
  tulle_meters?: number;
  tulle_cost?: number;
  sewing_cost?: number;
  installation_price?: number;
  accessories_cost?: number;
  line_total: number;
}

export interface CreateQuotePayload {
  order_id: string;
  valid_until?: string;
  discount_amount?: number;
  installation_cost?: number;
  delivery_cost?: number;
  prepayment_percent?: number;
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

export interface QuotesListResponse {
  count: number;
  results: QuoteDTO[];
}

export async function fetchQuotes(orderId: string): Promise<QuotesListResponse> {
  return get<QuotesListResponse>(`/v1/quotes/?order=${orderId}`);
}

export async function createQuote(payload: CreateQuotePayload): Promise<QuoteDTO> {
  return post<QuoteDTO>('/v1/quotes/', payload);
}

export async function generateQuotePdf(quoteId: string): Promise<{ pdf_url: string; pdf_generated: boolean; path: string }> {
  return post<{ pdf_url: string; pdf_generated: boolean; path: string }>(`/v1/quotes/${quoteId}/generate-pdf/`, {});
}

// ============================================================================
// Order Materials API
// ============================================================================

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

export interface MaterialsListResponse {
  count: number;
  results: OrderMaterialDTO[];
}

export interface UpdateMaterialPayload {
  status: string;
  comment?: string;
}

export interface UpdateMaterialResponse {
  material: OrderMaterialDTO;
  order_material_readiness: string;
  order_material_readiness_label: string;
}

export async function fetchMaterials(orderId: string): Promise<MaterialsListResponse> {
  return get<MaterialsListResponse>(`/v1/orders/${orderId}/materials/`);
}

export async function updateMaterial(
  orderId: string,
  materialId: string,
  payload: UpdateMaterialPayload
): Promise<UpdateMaterialResponse> {
  return patch<UpdateMaterialResponse>(`/v1/orders/${orderId}/materials/${materialId}/`, payload);
}

// ============================================================================
// Order Completion Act (АВР) API
// ============================================================================

/**
 * Upload signed completion act file
 * POST /api/v1/orders/{id}/completion-act/upload-signed/
 * Uses FormData for multipart/form-data upload
 */
export async function uploadSignedCompletionAct(
  orderId: string,
  formData: FormData
): Promise<{ act: OrderCompletionActDTO; created: boolean; message: string }> {
  return post<{ act: OrderCompletionActDTO; created: boolean; message: string }>(
    `/v1/orders/${orderId}/completion-act/upload-signed/`,
    formData
  );
}

export interface CompletionChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface CompletionChecklistDTO {
  checklist: CompletionChecklistItem[];
  can_complete: boolean;
}

export async function getCompletionChecklist(orderId: string): Promise<CompletionChecklistDTO> {
  return get<CompletionChecklistDTO>(`/v1/orders/${orderId}/completion-checklist/`);
}

// ── Order Item management ──────────────────────────────────────────────────

export async function deleteOrderItem(orderId: string, itemId: string): Promise<void> {
  return del(`/v1/orders/${orderId}/items/${itemId}/`);
}

export async function updateOrderItemQuantity(
  orderId: string,
  itemId: string,
  quantity: number
): Promise<{ id: string; quantity: number; unit_price: string; total_price: string }> {
  return patch(`/v1/orders/${orderId}/items/${itemId}/`, { quantity });
}

export interface UpdateOrderItemPayload {
  room_name?: string;
  window_name?: string;
  sewing_type?: string;
  notes?: string;
  folds_count?: number | null;
  window_width_cm?: number | null;
  window_height_cm?: number | null;
  quantity?: number;
  unit_price?: string;
}

export async function updateOrderItem(
  orderId: string,
  itemId: string,
  data: UpdateOrderItemPayload
): Promise<UpdateOrderItemPayload & { id: string; total_price: string }> {
  return patch(`/v1/orders/${orderId}/items/${itemId}/`, data);
}
