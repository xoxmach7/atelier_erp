import { apiClient } from './client';
import type { Order, OrdersPage } from '../types/order';

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

// Execution summary shape (partial — only what mobile needs)
export interface OrderExecution {
  order_id: string;
  order_number: string;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    address?: string;
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
