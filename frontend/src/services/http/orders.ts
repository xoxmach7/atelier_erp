/**
 * Orders API Service
 * Handles all HTTP operations for orders
 */

import { get, post } from "./client";
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

/**
 * Order creation payload
 */
export interface OrderCreateDTO {
  customer: string;
  priority?: "low" | "normal" | "high" | "urgent";
  deadline_date?: string | null;
  description?: string;
  total_amount?: string;
  pickup_address?: string;
  delivery_address?: string;
}

/**
 * Create new order
 */
export async function createOrder(data: OrderCreateDTO): Promise<OrderDetailDTO> {
  return post<OrderDetailDTO>("/v1/orders/", data);
}
