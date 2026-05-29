import { apiClient } from './client';
import type { Order, OrderDetail } from '../types/order';

export async function fetchOrders(status?: string): Promise<Order[]> {
  const endpoint = status
    ? `/api/v1/orders/?status=${status}`
    : '/api/v1/orders/';
  return apiClient.get<Order[]>(endpoint);
}

export async function fetchOrderDetail(id: string): Promise<OrderDetail> {
  return apiClient.get<OrderDetail>(`/api/v1/orders/${id}/`);
}

export async function confirmOrder(id: string): Promise<Order> {
  return apiClient.post<Order>(`/api/v1/orders/${id}/confirm/`, {});
}

export async function cancelOrder(id: string, reason: string): Promise<Order> {
  return apiClient.post<Order>(`/api/v1/orders/${id}/cancel/`, { reason });
}
