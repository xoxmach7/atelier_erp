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
 * Order creation payload - matches backend OrderCreateSerializer
 * Backend fields: customer_id, items, installation_address_*, measurement_date, planned_completion, notes
 */
export interface OrderCreateDTO {
  customer_id: string;
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
}

/**
 * Create new order
 */
export async function createOrder(data: OrderCreateDTO): Promise<OrderDetailDTO> {
  return post<OrderDetailDTO>("/v1/orders/", data);
}
