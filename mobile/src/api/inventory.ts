import { apiClient } from './client';

/** Единицы измерения — совпадают с InventoryItem.Unit на бэкенде. */
export type InventoryUnit = 'm' | 'pcs' | 'pack';

export const UNIT_LABELS: Record<InventoryUnit, string> = {
  m: 'м',
  pcs: 'шт',
  pack: 'упак',
};

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category?: string;
  category_display?: string;
  unit: InventoryUnit;
  unit_display?: string;
  quantity: string;
  price_per_unit: string;
  low_stock_threshold: string;
  supplier?: string;
  note?: string;
  is_low_stock: boolean;
  is_active?: boolean;
}

interface InventoryPage {
  count?: number;
  results?: InventoryItem[];
}

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const res = await apiClient.get<InventoryPage | InventoryItem[]>('/api/v1/inventory-items/');
  if (Array.isArray(res)) return res;
  return res.results ?? [];
}

export interface InventoryItemPayload {
  sku?: string;
  name: string;
  unit: InventoryUnit;
  price_per_unit?: number | string;
  low_stock_threshold?: number | string;
  quantity?: number | string;
  category?: string;
  supplier?: string;
  note?: string;
}

export async function createInventoryItem(payload: InventoryItemPayload): Promise<InventoryItem> {
  return apiClient.post<InventoryItem>('/api/v1/inventory-items/', payload);
}

export async function updateInventoryItem(
  id: string,
  payload: Partial<InventoryItemPayload>,
): Promise<InventoryItem> {
  return apiClient.patch<InventoryItem>(`/api/v1/inventory-items/${id}/`, payload);
}

/** Мягкое удаление на бэкенде (is_active=false). */
export async function deleteInventoryItem(id: string): Promise<unknown> {
  return apiClient.del(`/api/v1/inventory-items/${id}/`);
}

/**
 * «Добавить количество» из ⋮-меню: приход материала на склад.
 * Отдельного эндпоинта прихода нет — прибавляем к текущему остатку.
 */
export async function addInventoryQuantity(
  item: InventoryItem,
  delta: number,
): Promise<InventoryItem> {
  const current = parseFloat(item.quantity) || 0;
  const next = Math.max(0, current + delta);
  return updateInventoryItem(item.id, { quantity: next });
}
