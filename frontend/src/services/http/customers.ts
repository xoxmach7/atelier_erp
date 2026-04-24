/**
 * Customers HTTP Service
 * Minimal service for customer selection in quote creation
 */

import { get } from "./client";

const CUSTOMERS_ENDPOINT = "/customers";

export interface CustomerDTO {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  address_city?: string;
}

export interface CustomerListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CustomerDTO[];
}

/**
 * Fetch customers list
 */
export async function fetchCustomers(
  search?: string
): Promise<CustomerListResponse> {
  return get<CustomerListResponse>(CUSTOMERS_ENDPOINT, {
    params: search ? { search } : undefined,
  });
}

/**
 * Fetch single customer by ID
 */
export async function fetchCustomerById(customerId: string): Promise<CustomerDTO> {
  return get<CustomerDTO>(`${CUSTOMERS_ENDPOINT}/${customerId}/`);
}
