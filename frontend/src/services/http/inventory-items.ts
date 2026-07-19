/**
 * Inventory Items API Service
 * Общий склад: ткань/тюль/карниз/фурнитура/прочее (модель InventoryItem).
 * Отдельно от fabrics.ts (каталог тканей для КП).
 */

import { get, post, patch, del } from "./client";
import type { InventoryItemDTO, InventoryItemCreateInput } from "@/types";

interface InventoryItemsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InventoryItemDTO[];
}

interface InventoryItemsFilter extends Record<string, string | number | boolean | undefined> {
  category?: string;
  unit?: string;
  supplier?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

/** Список позиций общего склада */
export async function fetchInventoryItems(
  filters?: InventoryItemsFilter,
): Promise<InventoryItemsListResponse> {
  return get<InventoryItemsListResponse>("/v1/inventory-items/", { params: filters });
}

/** Создать позицию склада (склад/владелец) */
export async function createInventoryItem(
  input: InventoryItemCreateInput,
): Promise<InventoryItemDTO> {
  return post<InventoryItemDTO>("/v1/inventory-items/", input);
}

/** Обновить позицию склада */
export async function updateInventoryItem(
  id: string,
  input: Partial<InventoryItemCreateInput>,
): Promise<InventoryItemDTO> {
  return patch<InventoryItemDTO>(`/v1/inventory-items/${id}/`, input);
}

/** Мягко удалить позицию склада */
export async function deleteInventoryItem(id: string): Promise<void> {
  return del<void>(`/v1/inventory-items/${id}/`);
}

/**
 * Добавить количество к остатку (например, поступила новая партия).
 *
 * Отдельного эндпоинта «приход» на бэке нет — прибавляем к текущему остатку
 * через обычный PATCH. Тот же приём уже используется в мобилке
 * (mobile/src/api/inventory.ts, addInventoryQuantity).
 */
export async function addInventoryQuantity(
  item: InventoryItemDTO,
  delta: number,
): Promise<InventoryItemDTO> {
  const current = parseFloat(item.quantity) || 0;
  const next = Math.max(0, current + delta);
  return updateInventoryItem(item.id, { quantity: String(next) });
}
