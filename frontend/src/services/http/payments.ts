/**
 * Payments API Service
 * Handles all HTTP operations for payments
 */

import { get } from "./client";
import type { PaymentDTO } from "@/types";

interface PaymentsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PaymentDTO[];
}

interface PaymentsFilter extends Record<string, string | number | boolean | undefined> {
  order?: string;
  payment_type?: string;
  payment_method?: string;
  page?: number;
  page_size?: number;
}

/**
 * Fetch paginated list of payments
 */
export async function fetchPayments(filters?: PaymentsFilter): Promise<PaymentsListResponse> {
  return get<PaymentsListResponse>("/v1/payments/", {
    params: filters,
  });
}

/**
 * Fetch single payment by ID
 */
export async function fetchPaymentById(id: string): Promise<PaymentDTO> {
  return get<PaymentDTO>(`/v1/payments/${id}/`);
}
