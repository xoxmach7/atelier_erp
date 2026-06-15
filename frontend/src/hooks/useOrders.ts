/**
 * Orders TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchOrders,
  fetchOrderById,
  fetchOrderExecution,
  createOrder,
  updateOrder,
  changeOrderStatus,
  changeMaterialReadiness,
  changeProductionStage,
  changeHandoverStage,
  cancelOrder,
  generateOrderItemsFromQuote,
  getOrderPhotoReports,
  uploadOrderPhotoReport,
  getOrderCompletionAct,
  createOrderCompletionAct,
  uploadSignedCompletionAct,
  deleteOrderItem,
  updateOrderItemQuantity,
  updateOrderItem,
} from "@/services/http/orders";
import type { UpdateOrderItemPayload } from "@/services/http/orders";
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

interface UseOrdersOptions {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const ORDERS_QUERY_KEY = "orders";

/**
 * Hook for fetching paginated orders list
 */
export function useOrders(options: UseOrdersOptions = {}) {
  const { status, search, page = 1, pageSize = 20 } = options;

  return useQuery<OrdersListResponse, Error>({
    queryKey: [ORDERS_QUERY_KEY, { status, search, page, pageSize }],
    queryFn: () =>
      fetchOrders({
        status,
        search,
        page,
        page_size: pageSize,
      }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching single order by ID
 */
export function useOrder(orderId: string | null) {
  return useQuery<OrderDetailDTO, Error>({
    queryKey: [ORDERS_QUERY_KEY, "detail", orderId],
    queryFn: () => fetchOrderById(orderId!),
    enabled: !!orderId, // Only fetch if orderId is provided
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for creating a new order
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation<OrderDetailDTO, Error, OrderCreateDTO>({
    mutationFn: createOrder,
    onSuccess: (data) => {
      // Invalidate orders list to show new order
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
      // Pre-populate cache with new order details
      queryClient.setQueryData([ORDERS_QUERY_KEY, "detail", data.id], data);
    },
  });
}

/**
 * Hook for updating an order
 */
export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation<OrderDetailDTO, Error, { orderId: string; data: OrderUpdateDTO }>({
    mutationFn: ({ orderId, data }) => updateOrder(orderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    },
  });
}

// ============================================================================
// Order Execution Hooks
// ============================================================================

const EXECUTION_QUERY_KEY = "order-execution";

/**
 * Hook for fetching order execution summary
 * GET /api/v1/orders/{id}/execution/
 */
export function useOrderExecution(orderId: string | null) {
  return useQuery<OrderExecutionDTO, Error>({
    queryKey: [EXECUTION_QUERY_KEY, orderId],
    queryFn: () => fetchOrderExecution(orderId!),
    enabled: !!orderId,
    staleTime: 10 * 1000, // 10 seconds - execution data changes frequently
  });
}

/**
 * Hook for changing order status
 */
export function useChangeOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation<ActionResponse, Error, { orderId: string; data: ChangeStatusRequest }>({
    mutationFn: ({ orderId, data }) => changeOrderStatus(orderId, data),
    onSuccess: (_, variables) => {
      // Invalidate execution and detail data
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    },
  });
}

/**
 * Hook for changing material readiness
 */
export function useChangeMaterialReadiness() {
  const queryClient = useQueryClient();

  return useMutation<ActionResponse, Error, { orderId: string; data: ChangeMaterialReadinessRequest }>({
    mutationFn: ({ orderId, data }) => changeMaterialReadiness(orderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", variables.orderId] });
    },
  });
}

/**
 * Hook for changing production stage
 */
export function useChangeProductionStage() {
  const queryClient = useQueryClient();

  return useMutation<ActionResponse, Error, { orderId: string; data: ChangeProductionStageRequest }>({
    mutationFn: ({ orderId, data }) => changeProductionStage(orderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", variables.orderId] });
    },
  });
}

/**
 * Hook for changing handover stage
 */
export function useChangeHandoverStage() {
  const queryClient = useQueryClient();

  return useMutation<ActionResponse, Error, { orderId: string; data: ChangeHandoverStageRequest }>({
    mutationFn: ({ orderId, data }) => changeHandoverStage(orderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", variables.orderId] });
    },
  });
}

/**
 * Hook for cancelling order
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation<ActionResponse, Error, { orderId: string; data: CancelOrderRequest }>({
    mutationFn: ({ orderId, data }) => cancelOrder(orderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    },
  });
}

/**
 * Hook for generating order items from quote
 */
export function useGenerateOrderItems() {
  const queryClient = useQueryClient();

  return useMutation<
    { order: OrderDetailDTO; created_count: number; message: string },
    Error,
    { orderId: string; quoteId?: string }
  >({
    mutationFn: ({ orderId, quoteId }) => generateOrderItemsFromQuote(orderId, quoteId),
    onSuccess: (_, variables) => {
      // Invalidate order and execution data
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", variables.orderId] });
    },
  });
}

const PHOTO_REPORTS_QUERY_KEY = "photo-reports";

/**
 * Hook for fetching photo reports for an order
 */
export function useOrderPhotoReports(orderId: string) {
  return useQuery<PhotoReportListDTO, Error>({
    queryKey: [PHOTO_REPORTS_QUERY_KEY, orderId],
    queryFn: () => getOrderPhotoReports(orderId),
    enabled: !!orderId,
  });
}

/**
 * Hook for uploading photo report
 */
export function useUploadOrderPhotoReport(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation<PhotoReportDTO, Error, FormData>({
    mutationFn: (formData) => uploadOrderPhotoReport(orderId, formData),
    onSuccess: () => {
      // Invalidate photo reports and execution data
      queryClient.invalidateQueries({ queryKey: [PHOTO_REPORTS_QUERY_KEY, orderId] });
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, orderId] });
    },
  });
}

const COMPLETION_ACT_QUERY_KEY = "completion-act";

/**
 * Hook for fetching order completion act (АВР)
 */
export function useOrderCompletionAct(orderId: string | null) {
  return useQuery<CompletionActResponse, Error>({
    queryKey: [COMPLETION_ACT_QUERY_KEY, orderId],
    queryFn: () => getOrderCompletionAct(orderId!),
    enabled: !!orderId,
    staleTime: 10 * 1000, // 10 seconds
  });
}

/**
 * Hook for creating order completion act (АВР)
 */
export function useCreateOrderCompletionAct() {
  const queryClient = useQueryClient();

  return useMutation<CompletionActResponse, Error, string>({
    mutationFn: (orderId) => createOrderCompletionAct(orderId),
    onSuccess: (_, orderId) => {
      // Invalidate completion act and execution data
      queryClient.invalidateQueries({ queryKey: [COMPLETION_ACT_QUERY_KEY, orderId] });
      queryClient.invalidateQueries({ queryKey: [EXECUTION_QUERY_KEY, orderId] });
    },
  });
}

/**
 * Hook for uploading signed completion act file
 */
export function useUploadSignedCompletionAct() {
  const queryClient = useQueryClient();

  return useMutation<
    { act: OrderCompletionActDTO; created: boolean; message: string },
    Error,
    { orderId: string; formData: FormData }
  >({
    mutationFn: ({ orderId, formData }) => uploadSignedCompletionAct(orderId, formData),
    onSuccess: (_, variables) => {
      // Invalidate completion act and execution data
      queryClient.invalidateQueries({
        queryKey: [COMPLETION_ACT_QUERY_KEY, variables.orderId],
      });
      queryClient.invalidateQueries({
        queryKey: [EXECUTION_QUERY_KEY, variables.orderId],
      });
    },
  });
}

/**
 * Hook for deleting an order item
 */
export function useDeleteOrderItem(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (itemId) => deleteOrderItem(orderId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    },
  });
}

/**
 * Hook for updating order item quantity
 */
export function useUpdateOrderItemQuantity(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; quantity: number; unit_price: string; total_price: string },
    Error,
    { itemId: string; quantity: number }
  >({
    mutationFn: ({ itemId, quantity }) => updateOrderItemQuantity(orderId, itemId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    },
  });
}

/**
 * Hook for full edit of an order item
 */
export function useUpdateOrderItem(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; total_price: string },
    Error,
    { itemId: string; data: UpdateOrderItemPayload }
  >({
    mutationFn: ({ itemId, data }) => updateOrderItem(orderId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY, "detail", orderId] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    },
  });
}
