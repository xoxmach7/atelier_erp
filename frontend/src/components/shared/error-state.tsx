"use client";

import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Props for ErrorState component
 */
interface ErrorStateProps {
  /** Main error title */
  title?: string;
  /** Error description or message */
  description?: string;
  /** Additional context (e.g., backend URL info) */
  context?: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * ErrorState - Consistent error display for failed data loading
 *
 * Provides uniform error UI across all pages with:
 * - Red warning styling
 * - Consistent icon placement
 * - Optional context information
 *
 * Use this instead of inline error cards for consistency.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorState
 *   title="Failed to load orders"
 *   description={error?.message || "Something went wrong"}
 * />
 *
 * // With context
 * <ErrorState
 *   title="Failed to load fabrics"
 *   description={error?.message}
 *   context={`Backend: ${process.env.NEXT_PUBLIC_API_BASE_URL}`}
 * />
 * ```
 */
export function ErrorState({
  title = "Ошибка загрузки данных",
  description = "Что-то пошло не так. Попробуйте позже.",
  context,
  className,
}: ErrorStateProps) {
  return (
    <Card className={cn("border-red-200 bg-red-50", className)}>
      <CardContent className="flex items-center gap-4 pt-6">
        <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-red-900">{title}</h3>
          <p className="text-sm text-red-700 mt-1">{description}</p>
          {context && (
            <p className="mt-2 text-xs text-red-600">{context}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Pre-configured error state presets for common scenarios
 */
export const ErrorStatePresets = {
  /** Generic backend connection error */
  backendConnection: (baseUrl?: string) => ({
    title: "Ошибка загрузки данных",
    description: "Не удалось подключиться к серверу. Проверьте соединение и попробуйте снова.",
    context: baseUrl ? `API endpoint: ${baseUrl}` : undefined,
  }),

  /** Orders-specific error */
  orders: (error?: Error) => ({
    title: "Ошибка загрузки заказов",
    description: error?.message || "Что-то пошло не так. Попробуйте позже.",
  }),

  /** Inventory-specific error */
  inventory: (error?: Error, baseUrl?: string) => ({
    title: "Ошибка загрузки склада",
    description: error?.message || "Не удалось загрузить данные склада.",
    context: baseUrl
      ? `Убедитесь, что бэкенд запущен: ${baseUrl}`
      : undefined,
  }),

  /** Payments-specific error */
  payments: (error?: Error) => ({
    title: "Ошибка загрузки платежей",
    description: error?.message || "Что-то пошло не так. Попробуйте позже.",
  }),

  /** Order detail-specific error */
  orderDetail: (error?: Error) => ({
    title: "Ошибка загрузки заказа",
    description: error?.message || "Что-то пошло не так. Попробуйте позже.",
  }),
};
