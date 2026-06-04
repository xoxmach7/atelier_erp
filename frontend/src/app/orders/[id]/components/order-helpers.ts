import type { OrderDetailDTO, OrderExecutionDTO, PhotoReportStatus } from "@/types";

export type OrderRoleView = "admin" | "designer" | "warehouse" | "production" | "installation" | "finance";

export const ORDER_ROLE_VIEWS: Array<{ value: OrderRoleView; label: string; helper: string }> = [
  { value: "admin", label: "Админ", helper: "Полный заказ" },
  { value: "designer", label: "Дизайнер", helper: "Замеры и КП" },
  { value: "warehouse", label: "Склад", helper: "Материалы" },
  { value: "production", label: "Пошив", helper: "Изделия" },
  { value: "installation", label: "Установка", helper: "Фото и АВР" },
  { value: "finance", label: "Финансы", helper: "Оплата" },
];

export function formatCurrency(value: string | null): string {
  const amount = Number.parseFloat(value || "0");
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function parseAmount(value: string | number | null | undefined): number {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return amount === null || amount === undefined || Number.isNaN(amount) ? 0 : amount;
}

export function isOrderPaymentClosed(order: OrderDetailDTO, execution?: OrderExecutionDTO): boolean {
  const total = parseAmount(order.total_amount);
  const paid = parseAmount(order.paid_amount);
  const balance = parseAmount(order.balance_due);
  const executionBalance = execution ? parseAmount(execution.balance_due) : balance;
  return execution?.payment_state === "paid" || executionBalance <= 0 || balance <= 0 || (total > 0 && paid >= total);
}

export function getDisplayPaymentLabel(order: OrderDetailDTO, execution?: OrderExecutionDTO): string {
  if (isOrderPaymentClosed(order, execution)) return "Оплачено полностью";
  return execution?.payment_state_label || "Не оплачен";
}

export function getDisplayStageLabel(order: OrderDetailDTO, execution?: OrderExecutionDTO): string {
  if (order.status === "waiting_final_payment" && isOrderPaymentClosed(order, execution)) {
    return "Оплата закрыта";
  }
  return execution?.status_label || order.status;
}

export function getDisplayNextStep(order: OrderDetailDTO, execution?: OrderExecutionDTO): string {
  if (order.status === "waiting_final_payment" && isOrderPaymentClosed(order, execution)) {
    return "Проверить готовность и завершить заказ";
  }
  return execution?.next_step?.description || "Определите следующий этап заказа";
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

// Helper to detect UUID-like strings
export function isUuidLike(value: unknown): boolean {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// Helper to get safe fabric label - never returns UUID
export function getFabricLabel(item: { fabric_name?: string | null; fabric?: string | null }): string | null {
  if (item.fabric_name) return item.fabric_name;
  if (typeof item.fabric === "string" && !isUuidLike(item.fabric)) {
    return item.fabric;
  }
  return null;
}

// Helper to normalize photo report status from backend
export function normalizePhotoReportStatus(value: unknown): PhotoReportStatus {
  if (value === 'not_uploaded' || value === 'uploaded') return value;
  return 'not_available';
}

// Helper to resolve media URLs - handles both absolute and relative URLs
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const origin = apiBaseUrl.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}
