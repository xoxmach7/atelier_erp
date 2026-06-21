import { apiClient } from './client';
import type { Customer, CustomersPage, CustomerInput } from '../types/customer';

export async function fetchCustomers(search?: string): Promise<CustomersPage> {
  let endpoint = '/api/v1/customers/?page_size=200';
  if (search) endpoint += `&search=${encodeURIComponent(search)}`;
  return apiClient.get<CustomersPage>(endpoint);
}

export async function fetchCustomer(id: string): Promise<Customer> {
  return apiClient.get<Customer>(`/api/v1/customers/${id}/`);
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  return apiClient.post<Customer>('/api/v1/customers/', input);
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  return apiClient.patch<Customer>(`/api/v1/customers/${id}/`, input);
}

export async function deleteCustomer(id: string): Promise<unknown> {
  return apiClient.del(`/api/v1/customers/${id}/`);
}
