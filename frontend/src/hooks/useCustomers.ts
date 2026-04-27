/**
 * Customers TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCustomers, fetchCustomerById, createCustomer } from "@/services/http/customers";
import type { CustomerDTO, CustomerListResponse, CreateCustomerInput } from "@/services/http/customers";

const CUSTOMERS_QUERY_KEY = "customers";

/**
 * Hook for fetching customers list
 */
export function useCustomers(search?: string) {
  return useQuery<CustomerListResponse, Error>({
    queryKey: [CUSTOMERS_QUERY_KEY, { search }],
    queryFn: () => fetchCustomers(search),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for fetching single customer by ID
 */
export function useCustomer(customerId: string | null) {
  return useQuery<CustomerDTO, Error>({
    queryKey: [CUSTOMERS_QUERY_KEY, "detail", customerId],
    queryFn: () => fetchCustomerById(customerId!),
    enabled: !!customerId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for creating a new customer
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<CustomerDTO, Error, CreateCustomerInput>({
    mutationFn: createCustomer,
    onSuccess: () => {
      // Invalidate customers list to show new customer
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

export type { CustomerDTO, CustomerListResponse, CreateCustomerInput };
