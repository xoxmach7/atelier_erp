/**
 * Orders TanStack Query Hooks
 */

import { useQuery } from "@tanstack/react-query";
import { fetchOrders, fetchOrderById } from "@/services/http/orders";
import type { OrderListItemDTO, OrderDetailDTO } from "@/types";

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
