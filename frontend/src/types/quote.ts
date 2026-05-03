/**
 * Quote (Estimate) Types - Backend Integration Sprint
 *
 * NOTE: Uses /api/quotes/ legacy endpoint (DRF ViewSet).
 * Maps to backend Quote / QuoteItem models.
 *
 * Field Mapping (Old Estimate Draft → Backend Quote/QuoteItem):
 * ┌─────────────────────────────┬────────────────────────┬──────────────────────────────┐
 * │ Old Draft UI                │ Backend Field          │ Notes                        │
 * ├─────────────────────────────┼────────────────────────┼──────────────────────────────┤
 * │ Project.name                │ task reference         │ Quotes linked to Task        │
 * │ Project.client_name         │ task.client_name       │ Via Task relationship          │
 * │ Room.name                   │ QuoteItem.room_name    │ Preserved per line item        │
 * │ Item.name                   │ (not stored)           │ UI-only identifier             │
 * │ Item.width_cm               │ QuoteItem.window_width_cm │ Direct mapping              │
 * │ Item.height_cm              │ QuoteItem.window_height_cm │ Direct mapping             │
 * │ Item.curtain_fabric_id      │ QuoteItem.fabric       │ FK to Fabric                   │
 * │ Item.curtain_fabric_meters  │ QuoteItem.fabric_meters │ Direct mapping              │
 * │ Item.tulle_fabric_id        │ (separate item)        │ Create 2nd QuoteItem           │
 * │ Item.tulle_fabric_meters    │ (separate item)        │ Split into separate line       │
 * │ (calculated)                │ QuoteItem.line_total   │ Backend computed               │
 * └─────────────────────────────┴────────────────────────┴──────────────────────────────┘
 */

export type QuoteStatus = "draft" | "sent" | "approved" | "rejected" | "expired";

/**
 * Material Supply Mode - how fabric/material will be sourced
 */
export type SupplyMode = "in_stock" | "purchase_local" | "purchase_import" | "client_supplied";

/**
 * Quote Item DTO - matches backend QuoteItemSerializer
 * P0: Full component breakdown to prevent data loss
 */
export interface QuoteItemDTO {
  id: string;
  quote: string; // Quote ID
  room_name: string;
  window_name: string; // e.g., "Окно 1", "Дверь"
  // Measurements
  window_width_cm: number;
  window_height_cm: number;
  folds_count: number;
  // Main fabric (curtain / портьера)
  fabric: string | null; // Fabric ID
  fabric_details?: {
    id: string;
    hanger_number: string;
    name: string;
    price_per_meter: number;
  };
  fabric_meters: number;
  fabric_cost: number;
  // Tulle fabric (тюль) - P0: prevent data loss
  tulle_fabric: string | null; // Fabric ID
  tulle_fabric_details?: {
    id: string;
    hanger_number: string;
    name: string;
    price_per_meter: number;
  };
  tulle_meters: number;
  tulle_cost: number;
  supply_mode: SupplyMode;
  // Sewing
  sewing_type: string;
  complexity: string; // simple, medium, complex, premium
  sewing_cost: number;
  // Cornice / Curtain rod
  cornice: string | null; // Cornice ID
  cornice_details?: {
    id: string;
    sku: string;
    name: string;
    price: number;
  };
  cornice_length_m: number;
  cornice_cost: number;
  // Installation and additional services
  installation_price: number;
  accessories_cost: number;
  additional_services_total: number;
  // Total
  line_total: number;
  created_at: string;
}

/**
 * Linked order info when quote is converted to order
 */
export interface ConvertedOrderInfo {
  id: string;
  order_number: string;
  status: string;
  total_amount: string;
}

/**
 * Quote DTO - matches backend QuoteSerializer
 */
export interface QuoteDTO {
  id: string;
  quote_number: string; // Auto-generated: КП-YYYY-NNN
  // Relations
  task: string; // Task ID
  task_number?: string;
  customer: string; // Customer ID
  customer_name?: string;
  // Status
  status: QuoteStatus;
  // Financial breakdown
  subtotal: number;
  discount_amount: number;
  installation_cost: number;
  delivery_cost: number;
  total: number; // Computed by backend
  prepayment_percent: number;
  // Expiration
  valid_until: string | null;
  // PDF
  pdf_generated: boolean;
  pdf_url: string;
  // Items
  items: QuoteItemDTO[];
  // Conversion info
  converted_order: ConvertedOrderInfo | null;
  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Quote list response (paginated)
 */
export interface QuoteListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: QuoteDTO[];
}
