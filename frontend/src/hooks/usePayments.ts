/**
 * Payments TanStack Query Hooks
 */

import { useQuery } from "@tanstack/react-query";
import { fetchPayments, fetchPaymentById } from "@/services/http/payments";
import type { PaymentDTO } from "@/types";

interface PaymentsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PaymentDTO[];
}

interface UsePaymentsOptions {
  order?: string;
  paymentType?: string;
  paymentMethod?: string;
  page?: number;
  pageSize?: number;
}

const PAYMENTS_QUERY_KEY = "payments";

/**
 * Hook for fetching paginated payments list
 */
export function usePayments(options: UsePaymentsOptions = {}) {
  const { order, paymentType, paymentMethod, page = 1, pageSize = 20 } = options;

  return useQuery<PaymentsListResponse, Error>({
    queryKey: [PAYMENTS_QUERY_KEY, { order, paymentType, paymentMethod, page, pageSize }],
    queryFn: () =>
      fetchPayments({
        order,
        payment_type: paymentType,
        payment_method: paymentMethod,
        page,
        page_size: pageSize,
      }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching single payment by ID
 */
export function usePayment(paymentId: string | null) {
  return useQuery<PaymentDTO, Error>({
    queryKey: [PAYMENTS_QUERY_KEY, "detail", paymentId],
    queryFn: () => fetchPaymentById(paymentId!),
    enabled: !!paymentId, // Only fetch if paymentId is provided
    staleTime: 60 * 1000, // 1 minute
  });
}
