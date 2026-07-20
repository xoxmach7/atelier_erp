/**
 * Measurement Types - Backend Integration Sprint
 *
 * NOTE: Backend integration complete.
 * - Measurement API endpoints: /api/measurements/
 * - CRUD operations via REST API
 * - Data persistence: PostgreSQL via Django backend
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
 * Backend Measurement DTO
 * Phase 3: Measurement = what selected and how much needed (no prices)
 * Based on backend Measurement model fields.
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
  // Legacy fabric field (for compatibility)
  selected_fabric: string | null; // Fabric ID
  selected_fabric_details?: {
    id: string;
    hanger_number: string;
    name: string;
    price_per_meter: number;
  };
  selected_cornice_type: string;
  // Phase 3: Curtain and tulle fabrics with meters
  curtain_fabric: string | null; // Fabric ID
  curtain_fabric_details?: {
    id: string;
    hanger_number: string;
    name: string;
  };
  curtain_fabric_hanger?: string; // For list view
  curtain_fabric_name?: string;   // For list view
  curtain_meters: number;
  // Phase 3: Tulle fabric with meters
  tulle_fabric: string | null; // Fabric ID
  tulle_fabric_details?: {
    id: string;
    hanger_number: string;
    name: string;
  };
  tulle_fabric_hanger?: string;   // For list view
  tulle_fabric_name?: string;     // For list view
  tulle_meters: number;
  /** Крепление — позиция склада категории «Карниз» (заменяет старый mounting_type). */
  cornice_item: string | null; // InventoryItem ID
  cornice_item_details?: { id: string; name: string; unit: string; unit_display: string };
  cornice_quantity: number;
  /** Фурнитура — позиция склада категории «Фурнитура». */
  hardware_item: string | null; // InventoryItem ID
  hardware_item_details?: { id: string; name: string; unit: string; unit_display: string };
  hardware_quantity: number;
  notes: string;
  /** Сколько одинаковых изделий по этому окну (повторяющиеся окна). */
  quantity?: number;
  /** Склад отметил, что материалы по этому окну собраны. */
  materials_ready?: boolean;
  /** Цех отметил, что изделие по этому окну сшито. */
  sewing_done?: boolean;
  /** Установщик отметил, что изделие по этому окну повешено. */
  installation_done?: boolean;
  /**
   * Цена окна, посчитанная сервером из выбранных тканей: метраж × цена за
   * метр, отдельно шторы и тюль, затем × количество. Формула на бэке в
   * services/quote_calc.py — на клиенте её дублировать нельзя.
   */
  calculated_price?: string;
  price_breakdown?: {
    curtain_cost: string;
    tulle_cost: string;
    per_item: string;
    quantity: number;
    total: string;
  };
  measured_by: string | null; // User ID
  measured_by_name: string | null; // Display name from backend
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

/**
 * Source Task info (when order converted from task)
 */
export interface SourceTaskDTO {
  id: string;
  task_number: string;
  client_name: string;
  status: string;
}
