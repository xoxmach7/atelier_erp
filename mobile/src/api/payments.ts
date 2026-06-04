import { apiClient } from './client';
import type { PaymentSummary, PaymentFormData } from '../types/payment';

export async function fetchPayments(): Promise<PaymentSummary[]> {
  return apiClient.get<PaymentSummary[]>('/api/payments/');
}

export async function recordPayment(data: PaymentFormData): Promise<PaymentSummary> {
  return apiClient.post<PaymentSummary>('/api/payments/', data);
}
