/**
 * Orders API Service
 * Handles all HTTP operations for orders
 */

import { get } from "./client";
import type { OrderListItemDTO, OrderDetailDTO } from "@/types";

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
