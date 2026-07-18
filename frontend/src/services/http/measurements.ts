/**
 * Measurements HTTP Service
 * Backend API integration for measurements module
 */

import { get, post, patch, del } from "./client";
import type { MeasurementDTO, MeasurementListResponse } from "@/types";

const BASE_ENDPOINT = "/v1/measurements/";

interface FetchMeasurementsOptions extends Record<string, string | number | undefined> {
  order?: string;
  room_name?: string;
  mounting_type?: string;
  search?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
}

/**
 * Fetch measurements list with optional filtering
 */
export async function fetchMeasurements(
  options: FetchMeasurementsOptions = {}
): Promise<MeasurementListResponse> {
  return get<MeasurementListResponse>(BASE_ENDPOINT, { params: options });
}

/**
 * Fetch single measurement by ID
 */
export async function fetchMeasurementById(
  measurementId: string
): Promise<MeasurementDTO> {
  return get<MeasurementDTO>(`${BASE_ENDPOINT}${measurementId}/`);
}

/**
 * Create new measurement
 */
export async function createMeasurement(
  data: Omit<MeasurementDTO, "id" | "measured_at" | "measured_by_name">
): Promise<MeasurementDTO> {
  return post<MeasurementDTO>(BASE_ENDPOINT, data);
}

/**
 * Update existing measurement
 */
export async function updateMeasurement(
  measurementId: string,
  data: Partial<Omit<MeasurementDTO, "id" | "measured_at" | "measured_by" | "measured_by_name">>
): Promise<MeasurementDTO> {
  return patch<MeasurementDTO>(`${BASE_ENDPOINT}${measurementId}/`, data);
}

/**
 * Delete measurement
 */
export async function deleteMeasurement(measurementId: string): Promise<void> {
  return del<void>(`${BASE_ENDPOINT}${measurementId}/`);
}
