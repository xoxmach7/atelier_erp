import { apiClient } from './client';
import type { WorkQueueResponse } from '../types/work';

const ENDPOINTS = {
  owner: '/api/v1/work/owner/',
  designer: '/api/v1/work/designer/',
  quotes: '/api/v1/work/quotes/',
  warehouse: '/api/v1/work/warehouse/',
  production: '/api/v1/work/production/',
  installation: '/api/v1/work/installation/',
  finance: '/api/v1/work/finance/',
} as const;

export async function fetchOwnerQueue(): Promise<WorkQueueResponse> {
  return apiClient.get<WorkQueueResponse>(ENDPOINTS.owner);
}

export async function fetchDesignerQueue(): Promise<WorkQueueResponse> {
  return apiClient.get<WorkQueueResponse>(ENDPOINTS.designer);
}

export async function fetchQuotesQueue(): Promise<WorkQueueResponse> {
  return apiClient.get<WorkQueueResponse>(ENDPOINTS.quotes);
}

export async function fetchWarehouseQueue(): Promise<WorkQueueResponse> {
  return apiClient.get<WorkQueueResponse>(ENDPOINTS.warehouse);
}

export async function fetchProductionQueue(): Promise<WorkQueueResponse> {
  return apiClient.get<WorkQueueResponse>(ENDPOINTS.production);
}

export async function fetchInstallationQueue(): Promise<WorkQueueResponse> {
  return apiClient.get<WorkQueueResponse>(ENDPOINTS.installation);
}

export async function fetchFinanceQueue(): Promise<WorkQueueResponse> {
  return apiClient.get<WorkQueueResponse>(ENDPOINTS.finance);
}
