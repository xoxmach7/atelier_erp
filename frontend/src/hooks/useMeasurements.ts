/**
 * Measurements TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMeasurements,
  fetchMeasurementById,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from "@/services/http/measurements";
import type { MeasurementDTO, MeasurementListResponse } from "@/types";

interface FetchMeasurementsOptions {
  order?: string;
  room_name?: string;
  mounting_type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  ordering?: string;
}

const MEASUREMENTS_QUERY_KEY = "measurements";

/**
 * Hook for fetching measurements list
 */
export function useMeasurements(options: FetchMeasurementsOptions = {}) {
  const { order, room_name, mounting_type, search, page = 1, pageSize = 20, ordering } = options;

  return useQuery<MeasurementListResponse, Error>({
    queryKey: [MEASUREMENTS_QUERY_KEY, { order, room_name, mounting_type, search, page, pageSize, ordering }],
    queryFn: () =>
      fetchMeasurements({
        order,
        room_name,
        mounting_type,
        search,
        page,
        page_size: pageSize,
        ordering,
      }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching single measurement by ID
 */
export function useMeasurement(measurementId: string | null) {
  return useQuery<MeasurementDTO, Error>({
    queryKey: [MEASUREMENTS_QUERY_KEY, "detail", measurementId],
    queryFn: () => fetchMeasurementById(measurementId!),
    enabled: !!measurementId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for creating a new measurement
 */
export function useCreateMeasurement() {
  const queryClient = useQueryClient();

  return useMutation<MeasurementDTO, Error, Omit<MeasurementDTO, "id" | "measured_at" | "measured_by_name">>({
    mutationFn: createMeasurement,
    onSuccess: () => {
      // Invalidate measurements list to show new item
      queryClient.invalidateQueries({ queryKey: [MEASUREMENTS_QUERY_KEY] });
    },
  });
}

/**
 * Hook for updating an existing measurement
 */
export function useUpdateMeasurement() {
  const queryClient = useQueryClient();

  return useMutation<
    MeasurementDTO,
    Error,
    { id: string; data: Partial<Omit<MeasurementDTO, "id" | "measured_at" | "measured_by" | "measured_by_name">> }
  >({
    mutationFn: ({ id, data }) => updateMeasurement(id, data),
    onSuccess: (data) => {
      // Invalidate specific measurement and list
      queryClient.invalidateQueries({ queryKey: [MEASUREMENTS_QUERY_KEY, "detail", data.id] });
      queryClient.invalidateQueries({ queryKey: [MEASUREMENTS_QUERY_KEY] });
    },
  });
}

/**
 * Hook for deleting a measurement
 */
export function useDeleteMeasurement() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteMeasurement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEASUREMENTS_QUERY_KEY] });
    },
  });
}
