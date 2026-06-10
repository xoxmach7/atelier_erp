/**
 * Customers TanStack Query Hooks — full CRUD
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCustomers,
  fetchCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/services/http/customers";
import type {
  CustomerDTO,
  CustomerListResponse,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/services/http/customers";

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
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

/**
 * Hook for updating an existing customer
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<CustomerDTO, Error, { customerId: string; data: UpdateCustomerInput }>({
    mutationFn: ({ customerId, data }) => updateCustomer(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

/**
 * Hook for deleting a customer
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

export type { CustomerDTO, CustomerListResponse, CreateCustomerInput, UpdateCustomerInput };
