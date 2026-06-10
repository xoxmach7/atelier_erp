/**
 * Customers HTTP Service
 * Full CRUD for /customers page
 */

import { get, post, patch, del } from "./client";

const CUSTOMERS_ENDPOINT = "/v1/customers/";

export interface CustomerDTO {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  address_city?: string;
}

export interface CreateCustomerInput {
  full_name: string;
  phone: string;
  email?: string;
  address_city?: string;
  address_street?: string;
  address_building?: string;
  address_apartment?: string;
  notes?: string;
}

export interface UpdateCustomerInput {
  full_name?: string;
  phone?: string;
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
  return get<CustomerDTO>(`${CUSTOMERS_ENDPOINT}${customerId}/`);
}

/**
 * Create a new customer
 */
export async function createCustomer(data: CreateCustomerInput): Promise<CustomerDTO> {
  return post<CustomerDTO>(CUSTOMERS_ENDPOINT, data);
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  customerId: string,
  data: UpdateCustomerInput
): Promise<CustomerDTO> {
  return patch<CustomerDTO>(`${CUSTOMERS_ENDPOINT}${customerId}/`, data);
}

/**
 * Delete a customer
 */
export async function deleteCustomer(customerId: string): Promise<void> {
  return del<void>(`${CUSTOMERS_ENDPOINT}${customerId}/`);
}
