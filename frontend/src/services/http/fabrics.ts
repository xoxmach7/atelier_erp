/**
 * Fabrics API Service
 * Handles all HTTP operations for fabric inventory
 */

import { get, del } from "./client";
import type { FabricDTO } from "@/types";

interface FabricsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FabricDTO[];
}

interface FabricsFilter extends Record<string, string | number | boolean | undefined> {
  category?: "fabric" | "tulle";
  color?: string;
  pattern?: string;
  supplier?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

/**
 * Fetch paginated list of fabrics
 */
export async function fetchFabrics(filters?: FabricsFilter): Promise<FabricsListResponse> {
  return get<FabricsListResponse>("/v1/inventory/", {
    params: filters,
  });
}

/**
 * Fetch single fabric by ID
 */
export async function fetchFabricById(id: string): Promise<FabricDTO> {
  return get<FabricDTO>(`/v1/inventory/${id}/`);
}

/**
 * Fetch fabrics with low stock (< 10 meters)
 */
export async function fetchLowStockFabrics(): Promise<{ count: number; fabrics: FabricDTO[] }> {
  return get<{ count: number; fabrics: FabricDTO[] }>("/v1/inventory/low_stock/");
}

/**
 * Удаляет осиротевшую Fabric-запись (нет живой позиции склада за спиной —
 * FabricDTO.is_orphan). Для строк с реальной InventoryItem за спиной эндпоинт
 * вернёт 400 — удалять нужно саму позицию склада, а не эту запись каталога.
 */
export async function deleteOrphanFabric(id: string): Promise<void> {
  return del<void>(`/v1/inventory/${id}/delete-orphan/`);
}
