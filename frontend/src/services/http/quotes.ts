/**
 * Quotes (Estimates) HTTP Service
 * Backend API integration for estimates module
 *
 * NOTE: Uses /api/quotes/ legacy endpoint (DRF ViewSet).
 * Not part of /api/v1/ service-layer architecture.
 */

import { get, post, patch, del } from "./client";
import type { QuoteDTO, QuoteListResponse, QuoteItemDTO, QuoteStatus, OrderDetailDTO } from "@/types";
import type { CreateQuoteInput } from "@/hooks/useQuotes";

const QUOTES_ENDPOINT = "/v1/quotes/";
const QUOTE_ITEMS_ENDPOINT = "/v1/quote-items";

interface FetchQuotesOptions extends Record<string, string | number | undefined> {
  status?: string;
  customer?: string;
  task?: string;
  search?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
}

/**
 * Fetch quotes list with optional filtering
 */
export async function fetchQuotes(
  options: FetchQuotesOptions = {}
): Promise<QuoteListResponse> {
  return get<QuoteListResponse>(QUOTES_ENDPOINT, { params: options });
}

/**
 * Fetch single quote by ID
 */
export async function fetchQuoteById(quoteId: string): Promise<QuoteDTO> {
  return get<QuoteDTO>(`${QUOTES_ENDPOINT}${quoteId}/`);
}

/**
 * Create new quote
 */
export async function createQuote(data: CreateQuoteInput): Promise<QuoteDTO> {
  return post<QuoteDTO>(QUOTES_ENDPOINT, data);
}

/**
 * Update existing quote
 */
export async function updateQuote(
  quoteId: string,
  data: Partial<Omit<QuoteDTO, "id" | "quote_number" | "total" | "pdf_generated" | "pdf_url" | "created_at" | "updated_at" | "created_by" | "updated_by" | "items">>
): Promise<QuoteDTO> {
  return patch<QuoteDTO>(`${QUOTES_ENDPOINT}${quoteId}/`, data);
}

/**
 * Delete quote
 */
export async function deleteQuote(quoteId: string): Promise<void> {
  return del<void>(`${QUOTES_ENDPOINT}${quoteId}/`);
}

// Quote Items API

interface QuoteItemCreateData {
  room_name: string;
  window_width_cm: number;
  window_height_cm: number;
  folds_count?: number;
  fabric?: string | null;
  fabric_meters?: number;
  fabric_cost?: number;
  sewing_type?: string;
  complexity?: string;
  sewing_cost?: number;
  accessories_cost?: number;
  cornice?: string | null;
  cornice_cost?: number;
}

/**
 * Fetch quote items for a specific quote
 */
export async function fetchQuoteItems(quoteId: string): Promise<QuoteItemDTO[]> {
  return get<QuoteItemDTO[]>(QUOTE_ITEMS_ENDPOINT, { params: { quote: quoteId } });
}

/**
 * Add item to quote via dedicated endpoint
 */
export async function addQuoteItem(
  quoteId: string,
  data: QuoteItemCreateData
): Promise<QuoteItemDTO> {
  return post<QuoteItemDTO>(`${QUOTES_ENDPOINT}${quoteId}/add_item/`, data);
}

/**
 * Create quote item directly
 */
export async function createQuoteItem(
  data: QuoteItemCreateData & { quote: string }
): Promise<QuoteItemDTO> {
  return post<QuoteItemDTO>(QUOTE_ITEMS_ENDPOINT, data);
}

/**
 * Update quote item
 */
export async function updateQuoteItem(
  itemId: string,
  data: Partial<QuoteItemCreateData>
): Promise<QuoteItemDTO> {
  return patch<QuoteItemDTO>(`${QUOTE_ITEMS_ENDPOINT}/${itemId}/`, data);
}

/**
 * Delete quote item
 */
export async function deleteQuoteItem(itemId: string): Promise<void> {
  return del<void>(`${QUOTE_ITEMS_ENDPOINT}/${itemId}/`);
}

/**
 * Convert quote to order
 * POST /api/quotes/{quoteId}/convert_to_order/
 */
export async function convertQuoteToOrder(quoteId: string): Promise<OrderDetailDTO> {
  return post<OrderDetailDTO>(`${QUOTES_ENDPOINT}${quoteId}/convert_to_order/`, {});
}
