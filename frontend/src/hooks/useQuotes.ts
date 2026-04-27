/**
 * Quotes (Estimates) TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchQuotes,
  fetchQuoteById,
  createQuote,
  updateQuote,
  deleteQuote,
  addQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
  convertQuoteToOrder,
} from "@/services/http/quotes";
import type { QuoteDTO, QuoteListResponse, QuoteItemDTO } from "@/types";

interface FetchQuotesOptions {
  status?: string;
  customer?: string;
  task?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  ordering?: string;
}

const QUOTES_QUERY_KEY = "quotes";

/**
 * Hook for fetching quotes list
 */
export function useQuotes(options: FetchQuotesOptions = {}) {
  const { status, customer, task, search, page = 1, pageSize = 20, ordering } = options;

  return useQuery<QuoteListResponse, Error>({
    queryKey: [QUOTES_QUERY_KEY, { status, customer, task, search, page, pageSize, ordering }],
    queryFn: () =>
      fetchQuotes({
        status,
        customer,
        task,
        search,
        page,
        page_size: pageSize,
        ordering,
      }),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching single quote by ID
 */
export function useQuote(quoteId: string | null) {
  return useQuery<QuoteDTO, Error>({
    queryKey: [QUOTES_QUERY_KEY, "detail", quoteId],
    queryFn: () => fetchQuoteById(quoteId!),
    enabled: !!quoteId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for creating a new quote
 */
export interface CreateQuoteInput {
  task?: string;
  customer: string;
  order?: string;  // Link to existing order when creating quote from order context
  status?: string;
  valid_until?: string | null;
  subtotal?: number;
  discount_amount?: number;
  installation_cost?: number;
  delivery_cost?: number;
  prepayment_percent?: number;
  items?: Array<{
    room_name: string;
    window_width_cm: number;
    window_height_cm: number;
    folds_count?: number;
    fabric?: string | null;
    fabric_meters?: number;
    fabric_cost?: number;
    supply_mode?: "in_stock" | "purchase_local" | "purchase_import" | "client_supplied";
    sewing_type?: string;
    complexity?: string;
    sewing_cost?: number;
    accessories_cost?: number;
    cornice?: string | null;
    cornice_cost?: number;
  }>;
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation<QuoteDTO, Error, CreateQuoteInput>({
    mutationFn: createQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY] });
    },
  });
}

/**
 * Hook for updating an existing quote
 */
export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation<
    QuoteDTO,
    Error,
    { id: string; data: Partial<Omit<QuoteDTO, "id" | "quote_number" | "total" | "pdf_generated" | "pdf_url" | "created_at" | "updated_at" | "created_by" | "updated_by" | "items">> }
  >({
    mutationFn: ({ id, data }) => updateQuote(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY, "detail", data.id] });
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY] });
    },
  });
}

/**
 * Hook for deleting a quote
 */
export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY] });
    },
  });
}

// Quote Item Hooks

const QUOTE_ITEMS_QUERY_KEY = "quote-items";

/**
 * Hook for adding item to quote
 */
export function useAddQuoteItem() {
  const queryClient = useQueryClient();

  return useMutation<
    QuoteItemDTO,
    Error,
    {
      quoteId: string;
      data: Omit<QuoteItemDTO, "id" | "quote" | "line_total" | "created_at" | "fabric_details" | "cornice_details">;
    }
  >({
    mutationFn: ({ quoteId, data }) => addQuoteItem(quoteId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY, "detail", variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY] });
    },
  });
}

/**
 * Hook for updating quote item
 */
export function useUpdateQuoteItem() {
  const queryClient = useQueryClient();

  return useMutation<
    QuoteItemDTO,
    Error,
    {
      itemId: string;
      quoteId: string;
      data: Partial<Omit<QuoteItemDTO, "id" | "quote" | "line_total" | "created_at" | "fabric_details" | "cornice_details">>;
    }
  >({
    mutationFn: ({ itemId, data }) => updateQuoteItem(itemId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY, "detail", variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY] });
    },
  });
}

/**
 * Hook for deleting quote item
 */
export function useDeleteQuoteItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { itemId: string; quoteId: string }>({
    mutationFn: ({ itemId }) => deleteQuoteItem(itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY, "detail", variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY] });
    },
  });
}

import type { OrderDetailDTO } from "@/types";
const ORDERS_QUERY_KEY = "orders";

/**
 * Hook for converting quote to order
 */
export function useConvertQuoteToOrder() {
  const queryClient = useQueryClient();

  return useMutation<OrderDetailDTO, Error, { quoteId: string }>({
    mutationFn: ({ quoteId }) => convertQuoteToOrder(quoteId),
    onSuccess: (data, variables) => {
      // Invalidate quotes to show updated converted_order
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY, "detail", variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: [QUOTES_QUERY_KEY] });
      // Pre-populate order cache with created order
      queryClient.setQueryData([ORDERS_QUERY_KEY, "detail", data.id], data);
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    },
  });
}
