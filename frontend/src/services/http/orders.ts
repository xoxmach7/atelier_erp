/**
 * Orders API Service
 * Handles all HTTP operations for orders
 */

import { get, post } from "./client";
import type {
  OrderListItemDTO,
  OrderDetailDTO,
  OrderExecutionDTO,
  OrderCreateDTO,
  ChangeStatusRequest,
  ChangeMaterialReadinessRequest,
  ChangeProductionStageRequest,
  ChangeHandoverStageRequest,
  CancelOrderRequest,
  ActionResponse,
  PhotoReportListDTO,
  PhotoReportDTO,
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
