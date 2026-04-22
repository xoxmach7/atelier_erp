/**
 * Fabrics TanStack Query Hooks
 */

import { useQuery } from "@tanstack/react-query";
import { fetchFabrics, fetchFabricById, fetchLowStockFabrics } from "@/services/http/fabrics";
import type { FabricDTO } from "@/types";

interface FabricsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FabricDTO[];
}

interface UseFabricsOptions {
  color?: string;
  pattern?: string;
  supplier?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

const FABRICS_QUERY_KEY = "fabrics";

/**
 * Hook for fetching paginated fabrics list
 */
export function useFabrics(options: UseFabricsOptions = {}) {
  const { color, pattern, supplier, isActive, search, page = 1, pageSize = 20 } = options;

  return useQuery<FabricsListResponse, Error>({
    queryKey: [FABRICS_QUERY_KEY, { color, pattern, supplier, isActive, search, page, pageSize }],
    queryFn: () =>
      fetchFabrics({
        color,
        pattern,
        supplier,
        is_active: isActive,
        search,
        page,
        page_size: pageSize,
      }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching single fabric by ID
 */
export function useFabric(fabricId: string | null) {
  return useQuery<FabricDTO, Error>({
    queryKey: [FABRICS_QUERY_KEY, "detail", fabricId],
    queryFn: () => fetchFabricById(fabricId!),
    enabled: !!fabricId, // Only fetch if fabricId is provided
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for fetching low stock fabrics
 */
export function useLowStockFabrics() {
  return useQuery<{ count: number; fabrics: FabricDTO[] }, Error>({
    queryKey: [FABRICS_QUERY_KEY, "low-stock"],
    queryFn: () => fetchLowStockFabrics(),
    staleTime: 60 * 1000, // 1 minute
  });
}
