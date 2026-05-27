/**
 * Payments TanStack Query Hooks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPayment, fetchPayments, fetchPaymentById } from "@/services/http/payments";
import type { CreatePaymentInput } from "@/services/http/payments";
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

/**
 * Hook for recording a new payment.
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation<PaymentDTO, Error, CreatePaymentInput>({
    mutationFn: createPayment,
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "detail", payment.order] });
      queryClient.invalidateQueries({ queryKey: ["order-execution", payment.order] });
    },
  });
}
