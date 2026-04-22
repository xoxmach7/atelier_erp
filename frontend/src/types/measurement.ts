/**
 * Measurement Types - Frontend Domain Types (Sprint 7 MVP)
 *
 * NOTE: MVP uses localStorage persistence only.
 * Backend Measurement model exists but has NO API endpoint yet.
 * When backend adds MeasurementViewSet, migrate to API persistence.
 */

export type MountingType = "ceiling" | "wall" | "niche" | "window_recess" | "";
export type CorniceType = "standard" | "hidden" | "electric" | "none" | "";
export type InstallationComplexity = "standard" | "complex" | "very_complex";

/**
 * Single window/item measurement
 */
export interface MeasurementItem {
  id: string;
  name: string; // e.g., "Window 1", "Balcony door"
  width_cm: number;
  height_cm: number;
  depth_cm?: number;
  ceiling_height_cm?: number;
  mounting_type: MountingType;
  cornice_type: CorniceType;
  is_electric_cornice: boolean;
  needs_electrical_access: boolean;
  installation_complexity: InstallationComplexity;
  notes: string;
}

/**
 * Room containing multiple measurement items
 */
export interface MeasurementRoom {
  id: string;
  name: string; // e.g., "Living Room", "Kitchen"
  items: MeasurementItem[];
}

/**
 * Measurement project/sheet structure
 * NOTE: MVP local-only, no backend save yet
 */
export interface MeasurementProject {
  id: string;
  name: string; // Project name
  client_name: string;
  measurement_date: string; // ISO date string (YYYY-MM-DD)
  measurer_name: string;
  rooms: MeasurementRoom[];
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

/**
 * Summary stats for a measurement project
 */
export interface MeasurementSummary {
  totalRooms: number;
  totalWindows: number;
  totalWidthCm: number;
  totalHeightCm: number;
  hasElectricCornice: boolean;
  needsElectricalAccess: boolean;
}

/**
 * Backend Measurement DTO (for future API integration)
 * Based on backend Measurement model fields.
 * NOTE: Not used in MVP - here for reference when API is ready.
 */
export interface MeasurementDTO {
  id: string;
  order: string; // Order ID
  room_name: string;
  window_name: string;
  width_cm: number;
  height_cm: number;
  depth_cm: number | null;
  ceiling_height_cm: number | null;
  mounting_type: string;
  window_type: string;
  has_radiator: boolean;
  has_slope: boolean;
  obstacles: string;
  selected_fabric: string | null; // Fabric ID
  selected_cornice_type: string;
  notes: string;
  measured_by: string | null; // User ID
  measured_at: string;
}

/**
 * Measurement list response (for future API integration)
 */
export interface MeasurementListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: MeasurementDTO[];
}
