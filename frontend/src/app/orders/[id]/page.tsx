"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  StatusBadge,
  ErrorState,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  useOrder,
  useOrderExecution,
  useChangeOrderStatus,
  useChangeMaterialReadiness,
  useChangeProductionStage,
  useChangeHandoverStage,
  useCancelOrder,
  useGenerateOrderItems,
  useOrderPhotoReports,
  useUploadOrderPhotoReport,
  useOrderCompletionAct,
  useCreateOrderCompletionAct,
  useUploadSignedCompletionAct,
} from "@/hooks/useOrders";
import { useCreateMeasurement, useUpdateMeasurement } from "@/hooks/useMeasurements";
import { useFabrics } from "@/hooks/useFabrics";
import type { OrderDetailDTO, OrderItemDTO, MeasurementDTO, PaymentDTO, TaskStatus, OrderExecutionDTO, AvailableActionDTO, WarningDTO, OrderStatus, DesignerMeasurementDTO, SelectedMaterialDTO, MaterialRequirementDTO, ProductionItemDTO, ProductionAssignmentDTO, PhotoReportDTO, PhotoReportStatus, PhotoReportSummaryDTO, CompletionActStatus, CompletionActSummaryDTO } from "@/types";
import {
  ArrowLeft,
  Package,
  MapPin,
  Calendar,
  User,
  Phone,
  CreditCard,
  FileText,
  Calculator,
  Ruler,
  ExternalLink,
  ArrowUpRight,
  Plus,
  CheckCircle,
  Edit,
  Clock,
  FileSpreadsheet,
  Play,
  CheckCheck,
  Truck,
  Loader2,
  Camera,
  Scissors,
  AlertCircle,
  Info,
  Sparkles,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

function formatCurrency(value: string | null): string {
  const amount = Number.parseFloat(value || "0");
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

// Helper to detect UUID-like strings
function isUuidLike(value: unknown): boolean {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// Helper to get safe fabric label - never returns UUID
function getFabricLabel(item: { fabric_name?: string | null; fabric?: string | null }): string | null {
  if (item.fabric_name) return item.fabric_name;
  if (typeof item.fabric === "string" && !isUuidLike(item.fabric)) {
    return item.fabric;
  }
  return null;
}

// Helper to normalize photo report status from backend
function normalizePhotoReportStatus(value: unknown): PhotoReportStatus {
  if (value === 'not_uploaded' || value === 'uploaded') return value;
  return 'not_available';
}

// Helper to resolve media URLs - handles both absolute and relative URLs
function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const origin = apiBaseUrl.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function OrderItemRow({ item }: { item: OrderItemDTO }) {
  // Get safe fabric label - never shows UUID
  const fabricLabel = getFabricLabel(item);
  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0">
      <div className="flex-1">
        <div className="font-medium">{item.notes || item.item_type}</div>
        <div className="text-sm text-slate-500 mt-1">
          {item.item_type}
          {fabricLabel && ` • ${fabricLabel}`}
          {item.cornice && ` • ${item.cornice}`}
          {item.service && ` • ${item.service}`}
          {item.window_width_cm && item.window_height_cm && ` • ${item.window_width_cm}×${item.window_height_cm}cm`}
        </div>
      </div>
      <div className="text-right ml-4">
        <div className="font-medium">
          {item.quantity} × {formatCurrency(item.unit_price)}
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {formatCurrency(item.total_price)}
        </div>
      </div>
    </div>
  );
}

function FinancialSummary({ order }: { order: OrderDetailDTO }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Финансовая сводка
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-600">Сумма</span>
          <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Оплачено</span>
          <span className="font-medium text-green-600">{formatCurrency(order.paid_amount)}</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-slate-900 font-medium">Остаток</span>
          <span className={`font-bold ${parseFloat(order.balance_due) > 0 ? "text-amber-600" : "text-green-600"}`}>
            {formatCurrency(order.balance_due)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerInfo({ order }: { order: OrderDetailDTO }) {
  // V1 API returns customer as nested object {id, full_name, phone} or string
  const customerData = typeof order.customer === 'object' ? order.customer : null;
  const customerName = customerData?.full_name || 'Неизвестный клиент';
  const customerPhone = customerData?.phone || 'Нет телефона';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          Клиент
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="font-medium text-lg">{customerName}</div>
        <div className="flex items-center gap-2 text-slate-600">
          <Phone className="h-4 w-4" />
          {customerPhone}
        </div>
      </CardContent>
    </Card>
  );
}

function InstallationAddress({ order }: { order: OrderDetailDTO }) {
  const parts = [
    order.installation_address_city,
    order.installation_address_street,
    order.installation_address_building,
    order.installation_address_apartment && `кв. ${order.installation_address_apartment}`,
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Адрес установки
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>{parts.join(", ")}</div>
        {order.installation_address_notes && (
          <div className="text-sm text-slate-500 italic">
            {order.installation_address_notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderDates({ order }: { order: OrderDetailDTO }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Даты
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Измерение</span>
          <span>{formatDate(order.measurement_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Установка</span>
          <span>{formatDate(order.installation_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Плановое завершение</span>
          <span>{formatDate(order.planned_completion)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Фактическое завершение</span>
          <span>{formatDate(order.actual_completion)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface OrderItemsProps {
  items: OrderItemDTO[];
  quoteItems?: SelectedMaterialDTO[];
  orderId?: string;
  canGenerate?: boolean;
  onGenerate?: () => void;
  error?: string | null;
  quoteStatus?: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | null;
}

function OrderItems({ items, quoteItems, orderId, canGenerate, onGenerate, error, quoteStatus }: OrderItemsProps) {
  const hasItems = items.length > 0;
  const hasQuoteItems = quoteItems && quoteItems.length > 0;
  const isQuoteApproved = quoteStatus === 'approved';
  const hasQuoteButNotApproved = quoteStatus && !isQuoteApproved;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          {hasItems ? `Позиции заказа (${items.length})` : hasQuoteItems ? `Позиции из КП (${quoteItems.length})` : 'Позиции заказа'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Error display */}
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {hasItems ? (
          <div>
            {items.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </div>
        ) : hasQuoteItems ? (
          <div className="space-y-3">
            {canGenerate && onGenerate && (
              <Alert className={isQuoteApproved ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}>
                <Sparkles className={isQuoteApproved ? "h-4 w-4 text-blue-600" : "h-4 w-4 text-amber-600"} />
                <AlertTitle className={isQuoteApproved ? "text-blue-900" : "text-amber-900"}>
                  {isQuoteApproved ? 'Сформировать позиции заказа' : 'КП ещё не принято'}
                </AlertTitle>
                <AlertDescription className={isQuoteApproved ? "text-blue-700" : "text-amber-700"}>
                  {isQuoteApproved 
                    ? 'Позиции можно сформировать из КП для запуска в работу.' 
                    : 'Сначала примите КП, чтобы сформировать позиции заказа.'}
                </AlertDescription>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onGenerate}
                  disabled={!isQuoteApproved}
                  className="mt-2"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Сформировать из КП
                </Button>
              </Alert>
            )}
            {quoteItems.map((item, index) => (
              <div key={index} className="flex justify-between items-start py-2 border-b last:border-0">
                <div>
                  <div className="font-medium text-sm">{item.room || '—'}</div>
                  <div className="text-sm text-slate-600">
                    {item.fabric || 'Ткань не выбрана'}
                    {item.fabric_meters && ` • ${item.fabric_meters} м`}
                  </div>
                  {item.sewing_type && (
                    <div className="text-xs text-slate-500">{item.sewing_type}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 italic">Нет позиций</div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderNotes({ notes }: { notes: string | null }) {
  if (!notes) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Примечания
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm whitespace-pre-wrap">{notes}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Order Quick Actions - CTA cards for related modules
 * Contextual navigation with order prefill where supported
 * Actions filtered based on order status per business rules
 */
function OrderQuickActions({ orderId, customerId, orderStatus }: { orderId: string; customerId: string; orderStatus: string }) {
  // Check if orderId is valid (not a placeholder)
  const isValidOrderId = orderId && orderId !== "[id]" && orderId !== "%5Bid%5D" && !orderId.includes("[");

  // Check if order is active (payments allowed)
  // Allowed: new, in_work, in_production, ready, on_installation, waiting_final_payment
  // Blocked: completed, cancelled
  const isActiveOrder = ["new", "in_work", "in_production", "ready", "on_installation", "waiting_final_payment"].includes(orderStatus);

  const actions = [
    {
      title: "Смета",
      description: "Создать смету для клиента",
      icon: Calculator,
      // CRITICAL: Include order parameter for direct order -> quote linkage
      href: isValidOrderId
        ? `/estimate?customer=${customerId}&order=${orderId}`
        : `/estimate?customer=${customerId}`,
      variant: "default" as const,
      show: true,
    },
    {
      title: "Замеры",
      description: "Смотреть или добавить замеры",
      icon: Ruler,
      href: isValidOrderId ? `/measurements?order=${orderId}` : "/measurements",
      variant: "outline" as const,
      show: true,
    },
    {
      title: "Платежи",
      description: isActiveOrder ? "Записать платеж" : "Просмотреть платежи",
      icon: CreditCard,
      href: isValidOrderId ? `/payments?order=${orderId}` : "/payments",
      variant: "outline" as const,
      show: true,
    },
  ].filter(action => action.show);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Быстрые действия</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className={`group flex flex-col items-start gap-2 p-3 rounded-lg border transition-all hover:shadow-md ${
                  action.variant === "default"
                    ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Icon className="h-5 w-5" />
                  <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <div className="font-medium text-sm">{action.title}</div>
                  <div className={`text-xs ${action.variant === "default" ? "text-slate-300" : "text-slate-500"}`}>
                    {action.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Подставляет контекст где возможно
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderMetadata({ order }: { order: OrderDetailDTO }) {
  return (
    <div className="text-xs text-slate-400 mt-4">
      Создано: {formatDateTime(order.created_at)} • Обновлено: {formatDateTime(order.updated_at)}
    </div>
  );
}

/**
 * Measurements Section - Sheber Design
 */
function MeasurementsSection({ orderId, measurements }: { orderId: string; measurements: MeasurementDTO[] }) {
  // Check if orderId is valid (not a placeholder)
  const isValidOrderId = orderId && orderId !== "[id]" && orderId !== "%5Bid%5D" && !orderId.includes("[");
  const measurementsHref = isValidOrderId ? `/measurements?order=${orderId}` : "/measurements";

  return (
    <Card className="bg-[var(--card-sheber)] border-[var(--border-sheber)] shadow-[var(--sh)]">
      <CardHeader className="pb-3 border-b border-[var(--borderl)]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-[var(--t1)]">
            <Ruler className="h-4 w-4 text-[var(--a)]" />
            Замеры
            {measurements.length > 0 && (
              <span className="text-sm font-normal text-[var(--t3)]">({measurements.length})</span>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="text-[var(--a)] hover:bg-[var(--al)] hover:text-[var(--ad)]"
          >
            <Link href={measurementsHref}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {measurements.length === 0 ? (
          <div className="text-sm text-[var(--t2)]">
            Замеры не записаны.
            <Link 
              href={measurementsHref} 
              className="ml-2 text-[var(--a)] hover:text-[var(--ad)] hover:underline"
            >
              Создать замер
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {measurements.slice(0, 3).map((m) => (
              <div 
                key={m.id} 
                className="p-3 rounded-[var(--r)] bg-[var(--bg)] border border-[var(--borderl)]"
              >
                {/* Header: Room / Window */}
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-[var(--t1)]">
                    {m.room_name} / {m.window_name || 'Окно'}
                  </div>
                  <div className="text-xs text-[var(--t3)]">
                    {m.width_cm}×{m.height_cm} см
                  </div>
                </div>

                {/* Fabrics */}
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--t3)]">Шторы:</span>
                    <span className="text-[var(--t1)]">
                      {m.curtain_fabric_details?.name || m.curtain_fabric_name || 'не указана'}
                    </span>
                    {(m.curtain_meters && m.curtain_meters > 0) && (
                      <span className="text-xs text-[var(--t2)] bg-[var(--card-sheber)] px-1.5 py-0.5 rounded">
                        {m.curtain_meters} м
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--t3)]">Тюль:</span>
                    <span className="text-[var(--t1)]">
                      {m.tulle_fabric_details?.name || m.tulle_fabric_name || 'не указана'}
                    </span>
                    {(m.tulle_meters && m.tulle_meters > 0) && (
                      <span className="text-xs text-[var(--t2)] bg-[var(--card-sheber)] px-1.5 py-0.5 rounded">
                        {m.tulle_meters} м
                      </span>
                    )}
                  </div>
                </div>

                {/* Mounting & Notes */}
                <div className="mt-2 pt-2 border-t border-[var(--borderl)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {m.mounting_type && (
                      <span className="text-[var(--t3)] bg-[var(--card-sheber)] px-2 py-0.5 rounded-full">
                        {m.mounting_type}
                      </span>
                    )}
                    {m.notes && (
                      <span className="text-[var(--t3)] truncate max-w-[150px]">
                        {m.notes}
                      </span>
                    )}
                  </div>
                  <span className="text-[var(--t3)]">{formatDate(m.measured_at)}</span>
                </div>
              </div>
            ))}
            {measurements.length > 3 && (
              <Link 
                href={measurementsHref}
                className="text-sm text-[var(--a)] hover:text-[var(--ad)] hover:underline block pt-2"
              >
                Смотреть все {measurements.length} замеров →
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Payments Section - Shows related payments for this order
 */
function PaymentsSection({ orderId, payments, totalAmount, totalPaid, balanceDue, orderStatus }: {
  orderId: string; 
  payments: PaymentDTO[];
  totalAmount: string;
  totalPaid: string;
  balanceDue: string;
  orderStatus: string;
}) {
  // Check if orderId is valid (not a placeholder)
  const isValidOrderId = orderId && orderId !== "[id]" && orderId !== "%5Bid%5D" && !orderId.includes("[");
  const paymentsHref = isValidOrderId ? `/payments?order=${orderId}` : "/payments";

  // Payments allowed for active order statuses per business rules
  // Allowed: new, in_work, in_production, ready, on_installation, waiting_final_payment
  // Blocked: completed, cancelled
  const canCreatePayment = ["new", "in_work", "in_production", "ready", "on_installation", "waiting_final_payment"].includes(orderStatus);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Платежи
            {payments.length > 0 && (
              <span className="text-sm font-normal text-slate-500">({payments.length})</span>
            )}
          </CardTitle>
          {canCreatePayment ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={paymentsHref}>
                <Plus className="h-4 w-4 mr-1" />
                Новый платеж
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-slate-400">
              {orderStatus === "completed" || orderStatus === "cancelled" 
                ? "Заказ завершен" 
                : "Прием платежей приостановлен"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Payment Summary - Shows paid amount and remaining balance */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-slate-500">Итого</div>
            <div className="font-semibold">{formatCurrency(totalAmount)}</div>
          </div>
          <div>
            <div className="text-slate-500">Оплачено</div>
            <div className="font-semibold text-green-600">{formatCurrency(totalPaid)}</div>
          </div>
          <div>
            <div className="text-slate-500">Остаток</div>
            <div className={`font-semibold ${parseFloat(balanceDue) > 0 ? "text-amber-600" : "text-green-600"}`}>
              {formatCurrency(balanceDue)}
            </div>
          </div>
        </div>
        
        {/* Recent Payments */}
        {payments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              {payments.slice(0, 2).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{p.payment_type}</span>
                  </div>
                  <div className="font-medium">{formatCurrency(p.amount)}</div>
                </div>
              ))}
              {payments.length > 2 && (
                <Link 
                  href={paymentsHref}
                  className="text-sm text-blue-600 hover:underline block pt-1"
                >
                  Смотреть все {payments.length} платежей →
                </Link>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Source Task Section - Shows originating task if converted from task
 */
function SourceTaskSection({ sourceTask }: { sourceTask: { id: string; task_number: string; client_name: string; status: string } | null }) {
  if (!sourceTask) return null;

  return (
    <Card className="bg-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Исходная задача
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{sourceTask.task_number}</div>
            <div className="text-sm text-slate-500">{sourceTask.client_name}</div>
          </div>
          <StatusBadge status={sourceTask.status as TaskStatus} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Source Quote Section - Shows originating quote if created from quote
 */
function SourceQuoteSection({ sourceQuote }: { sourceQuote: { id: string; quote_number: string; total: string; status: string } | null }) {
  if (!sourceQuote) return null;

  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-blue-900">
          <FileSpreadsheet className="h-4 w-4" />
          Исходное КП
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-blue-900">{sourceQuote.quote_number}</div>
            <div className="text-sm text-blue-700">
              Сумма КП: {formatCurrency(sourceQuote.total)}
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="border-blue-300 text-blue-700 hover:bg-blue-100">
            <Link href={`/quotes/${sourceQuote.id}`}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Открыть КП
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Related Quotes Section - Shows source quote if exists
 */
function RelatedQuotesSection({ order }: { order: OrderDetailDTO }) {
  const router = useRouter();
  
  // Combine source quote (if order created from quote) and related quotes (created from order)
  const allRelatedQuotes = [
    ...(order.source_quote ? [order.source_quote] : []),
    ...(order.related_quotes || [])
  ].filter((quote, index, quotes) => (
    quotes.findIndex((item) => item.id === quote.id) === index
  ));
  
  // Extract customer ID correctly whether customer is object or string
  const customerId = typeof order.customer === 'object' ? order.customer.id : order.customer;
  const orderId = order.id;
  
  // CRITICAL: Ensure order ID is always included in navigation
  const handleCreateQuote = () => {
    if (!orderId) {
      alert("Ошибка: ID заказа не найден");
      return;
    }
    const url = `/estimate?customer=${customerId}&order=${orderId}`;
    router.push(url);
  };

  // If there are any related quotes, show them
  if (allRelatedQuotes.length > 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Связанные КП ({allRelatedQuotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allRelatedQuotes.map((quote) => (
            <div key={quote.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
              <div>
                <div className="font-medium">{quote.quote_number}</div>
                <div className="text-sm text-slate-500">
                  Сумма: {formatCurrency(quote.total)}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/quotes/${quote.id}`}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Открыть
                </Link>
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={handleCreateQuote} className="w-full">
            <Calculator className="h-4 w-4 mr-2" />
            Добавить КП
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No quotes yet - direct order flow
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-slate-600">
          <Calculator className="h-4 w-4" />
          КП / Сметы
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium mr-2">
            Прямой заказ
          </span>{" "}
          Создайте КП, если нужен расчёт с позициями и ценами для клиента.
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCreateQuote} className="flex-1">
            <Calculator className="h-4 w-4 mr-2" />
            Создать КП
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Order Execution Panel - Shows workflow guidance, status controls, and material readiness
 * This is the core execution workflow UI for the order detail page
 * Uses real data from backend execution endpoint
 */
function OrderExecutionPanel({
  order,
  execution,
}: {
  order: OrderDetailDTO;
  execution?: OrderExecutionDTO;
}) {
  // Use backend data if available, otherwise fallback to order data
  const statusLabel = execution?.status_label || order.status;
  const productionStageLabel = execution?.production_stage_label || 'Не начато';
  const handoverStageLabel = execution?.handover_stage_label || 'Не требуется';
  const paymentStateLabel = execution?.payment_state_label || 'Не оплачен';

  // Next step from backend or fallback
  const nextStep = execution?.next_step;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4" />
          Состояние исполнения
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status Overview */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Статус заказа:</span>
            <span className="text-sm font-medium">{statusLabel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Производство:</span>
            <span className="text-sm font-medium">{productionStageLabel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Установка / выдача:</span>
            <span className="text-sm font-medium">{handoverStageLabel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Оплата:</span>
            <span className="text-sm font-medium">{paymentStateLabel}</span>
          </div>
        </div>

        {/* Next Step - from backend */}
        {nextStep && (
          <div className="pt-2 border-t">
            <h4 className="font-medium text-slate-900 mb-1">Следующий шаг</h4>
            <p className="text-sm text-slate-600">{nextStep.description}</p>
          </div>
        )}

        {/* Terminal State Indicator */}
        {order.status === 'completed' && (
          <div className="flex items-center gap-2 text-green-600 text-sm pt-2 border-t">
            <CheckCheck className="h-4 w-4" />
            <span>Заказ успешно завершён</span>
          </div>
        )}
        {order.status === 'cancelled' && (
          <div className="flex items-center gap-2 text-red-600 text-sm pt-2 border-t">
            <AlertCircle className="h-4 w-4" />
            <span>Заказ отменён</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Warnings and Blockers Section
 */
function WarningsSection({ warnings, blockers }: { warnings: WarningDTO[]; blockers: WarningDTO[] }) {
  if (warnings.length === 0 && blockers.length === 0) return null;

  return (
    <div className="space-y-3">
      {blockers.map((blocker, i) => (
        <Alert key={`blocker-${i}`} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Блокирует выполнение</AlertTitle>
          <AlertDescription>{blocker.message}</AlertDescription>
        </Alert>
      ))}
      {warnings.map((warning, i) => (
        <Alert key={`warning-${i}`} variant="default" className="bg-amber-50 border-amber-200">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Внимание</AlertTitle>
          <AlertDescription className="text-amber-700">{warning.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

/**
 * Available Actions Panel - Shows action buttons from backend
 */
function AvailableActionsPanel({
  actions,
  onAction,
  onCancel,
}: {
  actions: AvailableActionDTO[];
  onAction: (action: AvailableActionDTO) => void;
  onCancel: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  // Primary actions (no disabled_reason)
  const primaryActions = actions.filter((a) => !a.disabled_reason);
  // Secondary actions (with disabled_reason)
  const disabledActions = actions.filter((a) => a.disabled_reason);

  // Show first 3 primary actions, or all if showAll is true
  const displayedActions = showAll ? primaryActions : primaryActions.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="h-4 w-4" />
          Доступные действия
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary actions */}
        <div className="flex flex-wrap gap-2">
          {displayedActions.map((action) => (
            <Button
              key={action.action}
              variant={action.action === 'cancel' ? 'destructive' : 'default'}
              size="sm"
              onClick={() =>
                action.action === 'cancel' ? onCancel() : onAction(action)
              }
            >
              {action.label}
            </Button>
          ))}
          {primaryActions.length > 3 && (
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Скрыть' : `Ещё ${primaryActions.length - 3}`}
            </Button>
          )}
        </div>

        {/* Disabled actions */}
        {disabledActions.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500 mb-2">Недоступно:</p>
            <div className="space-y-2">
              {disabledActions.map((action) => (
                <div key={action.action} className="text-sm">
                  <span className="text-slate-400 line-through">{action.label}</span>
                  <span className="text-xs text-slate-400 ml-2">• {action.disabled_reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Designer/Measurer Section - Sheber Design
 */
function DesignerMeasurerSection({
  measurements,
  roomsCount,
  windowsCount,
  selectedMaterials,
  quoteItemsCount,
  orderId,
  onMeasurementCreated,
}: {
  measurements: DesignerMeasurementDTO[];
  roomsCount: number;
  windowsCount: number;
  selectedMaterials: SelectedMaterialDTO[];
  quoteItemsCount: number;
  orderId: string;
  onMeasurementCreated: () => void;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<DesignerMeasurementDTO | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const createMutation = useCreateMeasurement();
  const updateMutation = useUpdateMeasurement();

  // Group measurements by room
  const measurementsByRoom = measurements.reduce((acc, m) => {
    if (!acc[m.room_name]) {
      acc[m.room_name] = [];
    }
    acc[m.room_name].push(m);
    return acc;
  }, {} as Record<string, DesignerMeasurementDTO[]>);

  const handleCreate = async (data: MeasurementFormData) => {
    try {
      await createMutation.mutateAsync({
        order: orderId,
        room_name: data.room_name,
        window_name: data.window_name || '',
        width_cm: data.width_cm,
        height_cm: data.height_cm,
        depth_cm: data.depth_cm || null,
        ceiling_height_cm: null,
        mounting_type: data.mounting_type || '',
        window_type: '',
        has_radiator: false,
        has_slope: false,
        obstacles: '',
        selected_fabric: null,
        selected_cornice_type: '',
        // Phase 3: New fabric fields
        curtain_fabric: data.curtain_fabric || null,
        curtain_meters: data.curtain_meters || 0,
        tulle_fabric: data.tulle_fabric || null,
        tulle_meters: data.tulle_meters || 0,
        notes: data.notes || '',
        measured_by: null,
      });
      setIsCreateOpen(false);
      setSuccessMessage('Замер добавлен');
      onMeasurementCreated();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to create measurement:', err);
    }
  };

  const handleEdit = async (data: MeasurementFormData) => {
    if (!editingMeasurement) return;
    try {
      await updateMutation.mutateAsync({
        id: editingMeasurement.id,
        data: {
          room_name: data.room_name,
          window_name: data.window_name || '',
          width_cm: data.width_cm,
          height_cm: data.height_cm,
          depth_cm: data.depth_cm || null,
          mounting_type: data.mounting_type || '',
          window_type: '',
          selected_fabric: null,
          // Phase 3: New fabric fields
          curtain_fabric: data.curtain_fabric || null,
          curtain_meters: data.curtain_meters || 0,
          tulle_fabric: data.tulle_fabric || null,
          tulle_meters: data.tulle_meters || 0,
          notes: data.notes || '',
        },
      });
      setEditingMeasurement(null);
      setSuccessMessage('Замер обновлён');
      onMeasurementCreated();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update measurement:', err);
    }
  };

  return (
    <Card className="bg-[var(--card-sheber)] border-[var(--border-sheber)] shadow-[var(--sh)]">
      <CardHeader className="pb-3 border-b border-[var(--borderl)]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-[var(--t1)]">
            <Ruler className="h-4 w-4 text-[var(--a)]" />
            Замеры и изделия
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--t3)]">
              {roomsCount} комнат, {windowsCount} окон
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsCreateOpen(true)}
              className="border-[var(--a)] text-[var(--a)] hover:bg-[var(--al)] hover:text-[var(--ad)]"
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {successMessage && (
          <Alert className="bg-[var(--al)] border-[var(--a)]/20">
            <CheckCircle className="h-4 w-4 text-[var(--a)]" />
            <AlertDescription className="text-[var(--ad)]">{successMessage}</AlertDescription>
          </Alert>
        )}

        {measurements.length === 0 ? (
          <EmptyState
            title="Нет замеров"
            description="Добавьте замеры для окон"
            icon={<Ruler className="h-6 w-6 text-[var(--t3)]" />}
            action={{
              label: 'Добавить замер',
              onClick: () => setIsCreateOpen(true),
            }}
          />
        ) : (
          <div className="space-y-4">
            {Object.entries(measurementsByRoom).map(([roomName, roomMeasurements]) => (
              <div 
                key={roomName} 
                className="p-3 bg-[var(--bg)] rounded-[var(--rl)] border border-[var(--borderl)]"
              >
                <h4 className="font-medium text-[var(--t1)] mb-3 pb-2 border-b border-[var(--borderl)]">{roomName}</h4>
                <div className="space-y-2">
                  {roomMeasurements.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-[var(--card-sheber)] rounded-[var(--r)] border border-[var(--border-sheber)] hover:shadow-[var(--sh)] transition-shadow"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-[var(--t1)]">{m.window_name || 'Окно'}</span>
                          <span className="text-xs text-[var(--t3)]">
                            {m.width_cm}×{m.height_cm} см
                            {m.depth_cm && ` × ${m.depth_cm} см`}
                          </span>
                        </div>
                        {/* Phase 3: Display fabric data */}
                        <div className="space-y-1 text-sm">
                          {/* Curtain fabric */}
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--t3)]">Шторы:</span>
                            <span className="text-[var(--t1)] truncate">
                              {m.curtain_fabric_name || 'не указана'}
                            </span>
                            {(m.curtain_meters && m.curtain_meters > 0) && (
                              <span className="text-xs text-[var(--t2)] bg-[var(--bg)] px-1.5 py-0.5 rounded">
                                {m.curtain_meters} м
                              </span>
                            )}
                          </div>
                          {/* Tulle fabric */}
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--t3)]">Тюль:</span>
                            <span className="text-[var(--t1)] truncate">
                              {m.tulle_fabric_name || 'не указана'}
                            </span>
                            {(m.tulle_meters && m.tulle_meters > 0) && (
                              <span className="text-xs text-[var(--t2)] bg-[var(--bg)] px-1.5 py-0.5 rounded">
                                {m.tulle_meters} м
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          {m.mounting_type && (
                            <span className="text-[var(--t3)] bg-[var(--bg)] px-2 py-0.5 rounded-full">
                              {m.mounting_type}
                            </span>
                          )}
                          {m.notes && (
                            <span className="text-[var(--t3)] truncate max-w-[150px]">
                              {m.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingMeasurement(m)}
                        className="text-[var(--t3)] hover:text-[var(--a)] hover:bg-[var(--al)]"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedMaterials.length > 0 && (
          <div className="pt-3 border-t">
            <h4 className="text-sm font-medium text-slate-900 mb-2">Выбранные материалы (из КП)</h4>
            <div className="space-y-2">
              {selectedMaterials.map((mat, i) => (
                <div key={i} className="text-sm">
                  <div className="font-medium">{mat.room || '—'}</div>
                  <div className="space-y-0.5 text-xs text-slate-600">
                    {/* Curtain fabric */}
                    <div className="flex justify-between">
                      <span>Шторы: {mat.fabric || 'не указана'}</span>
                      {mat.fabric_meters && (
                        <span className="text-slate-500">{mat.fabric_meters} м</span>
                      )}
                    </div>
                    {/* Tulle fabric */}
                    <div className="flex justify-between">
                      <span>Тюль: {mat.tulle_fabric || 'не указана'}</span>
                      {mat.tulle_meters && (
                        <span className="text-slate-500">{mat.tulle_meters} м</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Create Modal */}
      <MeasurementModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        title="Добавить замер"
      />

      {/* Edit Modal */}
      {editingMeasurement && (
        <MeasurementModal
          isOpen={!!editingMeasurement}
          onClose={() => setEditingMeasurement(null)}
          onSubmit={handleEdit}
          title="Редактировать замер"
          initialData={{
            room_name: editingMeasurement.room_name,
            window_name: editingMeasurement.window_name,
            width_cm: editingMeasurement.width_cm,
            height_cm: editingMeasurement.height_cm,
            depth_cm: editingMeasurement.depth_cm || undefined,
            mounting_type: editingMeasurement.mounting_type,
            // Phase 3: Fabric fields
            curtain_fabric: editingMeasurement.curtain_fabric,
            curtain_meters: editingMeasurement.curtain_meters,
            tulle_fabric: editingMeasurement.tulle_fabric,
            tulle_meters: editingMeasurement.tulle_meters,
            notes: editingMeasurement.notes,
          }}
        />
      )}
    </Card>
  );
}

// Phase 3: Measurement form data with curtain and tulle fabrics
type MeasurementFormData = {
  room_name: string;
  window_name?: string;
  width_cm: number;
  height_cm: number;
  depth_cm?: number;
  mounting_type?: string;
  // Phase 3: Curtain and tulle fabrics with meters
  curtain_fabric?: string | null;
  curtain_meters?: number;
  tulle_fabric?: string | null;
  tulle_meters?: number;
  // Legacy fields (kept for compatibility)
  selected_fabric?: string | null;
  fabric_comment?: string;
  notes?: string;
};

/**
 * Warehouse Materials Section - Shows material requirements for warehouse role
 */
function WarehouseMaterialsSection({
  materialRequirements,
  materialReadiness,
  materialReadinessLabel,
  missingMaterials,
  missingMaterialsCount,
  totalFabricsRequired,
  orderId,
  onMaterialReadinessChanged,
  quoteMaterials,
  hasOrderItems,
  onGenerate,
}: {
  materialRequirements: MaterialRequirementDTO[];
  materialReadiness: string;
  materialReadinessLabel: string;
  missingMaterials: MaterialRequirementDTO[];
  missingMaterialsCount: number;
  totalFabricsRequired: number;
  orderId: string;
  onMaterialReadinessChanged: () => void;
  quoteMaterials?: SelectedMaterialDTO[];
  hasOrderItems?: boolean;
  onGenerate?: () => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const changeMaterialMutation = useChangeMaterialReadiness();

  const readinessOptions = [
    { value: 'not_ready', label: 'Не обеспечен', color: 'text-red-600', bg: 'bg-red-50' },
    { value: 'partially_ready', label: 'Частично обеспечен', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { value: 'ready', label: 'Обеспечен материалами', color: 'text-green-600', bg: 'bg-green-50' },
  ];

  const currentReadiness = readinessOptions.find(r => r.value === materialReadiness) || readinessOptions[0];
  const hasMaterialData = materialRequirements.length > 0 || Boolean(quoteMaterials?.length) || Boolean(hasOrderItems);

  const supplyModeLabels: Record<string, string> = {
    client_supplied: "Закупает клиент",
    purchase_local: "Закупка в РФ",
    purchase_import: "Импорт",
    in_stock: "В наличии",
  };

  // Helper to safely get supply mode label
  function getSupplyModeLabel(supplyMode?: string | null): string {
    if (!supplyMode) return "Не указано";
    return supplyModeLabels[supplyMode] || supplyMode;
  }

  const handleReadinessChange = async (newReadiness: string) => {
    try {
      await changeMaterialMutation.mutateAsync({
        orderId,
        data: { material_readiness: newReadiness as 'not_ready' | 'partially_ready' | 'ready' },
      });
      setSuccessMessage('Готовность материалов обновлена');
      setIsModalOpen(false);
      setTimeout(() => {
        setSuccessMessage(null);
        onMaterialReadinessChanged();
      }, 1500);
    } catch (err) {
      console.error('Failed to update material readiness:', err);
    }
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Материалы / Склад
          </CardTitle>
          {hasMaterialData && (
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${currentReadiness.bg} ${currentReadiness.color}`}>
                {materialReadinessLabel}
              </span>
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
                Изменить
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {successMessage && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Material Readiness Summary */}
        {hasMaterialData && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Всего тканей:</span>
              <span className="font-medium">{totalFabricsRequired}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Не хватает на складе:</span>
              <span className={`font-medium ${missingMaterialsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {missingMaterialsCount}
              </span>
            </div>
          </>
        )}

        {/* Material Readiness Warnings */}
        {hasMaterialData && materialReadiness === 'not_ready' && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Внимание</AlertTitle>
            <AlertDescription>
              Материалы не обеспечены. Производство запускать нельзя.
            </AlertDescription>
          </Alert>
        )}

        {hasMaterialData && materialReadiness === 'partially_ready' && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Внимание</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Материалы обеспечены частично. Производство можно начать с риском остановки.
            </AlertDescription>
          </Alert>
        )}

        {/* Import Warning */}
        {hasMaterialData && materialRequirements.some(m => m.supply_mode === 'purchase_import') && (
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              Есть импортные материалы — возможна задержка.
            </AlertDescription>
          </Alert>
        )}

        {/* Material Requirements List */}
        {materialRequirements.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Список материалов:</h4>
            {materialRequirements.map((material, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded text-sm ${
                  material.in_stock ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium">{material.name}</div>
                  {material.hanger_number && (
                    <div className="text-xs text-slate-500">Вешалка: {material.hanger_number}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600">
                    {material.required_meters ? `${material.required_meters} м` : '—'}
                  </div>
                  <div className={`text-xs ${
                    material.supply_mode === 'in_stock' ? 'text-green-600' :
                    material.supply_mode === 'purchase_import' ? 'text-amber-600' :
                    'text-blue-600'
                  }`}>
                    {getSupplyModeLabel(material.supply_mode)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {quoteMaterials && quoteMaterials.length > 0 && !hasOrderItems ? (
              <div className="space-y-3">
                <Alert className="bg-amber-50 border-amber-200">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700">
                    Позиции заказа ещё не сформированы. Склад видит предварительные материалы из принятого КП.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700">Предварительные материалы из КП:</h4>
                  {quoteMaterials.map((material, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded text-sm bg-slate-50">
                      <div className="flex-1">
                        <div className="font-medium">{material.fabric || '—'}</div>
                        {material.room && (
                          <div className="text-xs text-slate-500">Комната: {material.room}</div>
                        )}
                      </div>
                      <div className="text-right">
                        {material.fabric_meters && (
                          <div className="text-xs text-slate-600">{material.fabric_meters} м</div>
                        )}
                        <div className="text-xs text-slate-500">
                          {getSupplyModeLabel(material.supply_mode)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {onGenerate && (
                  <Button onClick={onGenerate} variant="outline" className="w-full">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Сформировать позиции заказа
                  </Button>
                )}
              </div>
            ) : (
              <EmptyState
                title="Материалы ещё не рассчитаны"
                description="Материалы появятся после создания КП или позиций заказа."
                icon={<Package className="h-6 w-6 text-slate-400" />}
              />
            )}
          </>
        )}
      </CardContent>

      {/* Material Readiness Modal */}
      <MaterialReadinessModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentReadiness={materialReadiness}
        onSelect={handleReadinessChange}
      />
    </Card>
  );
}

/**
 * Material Readiness Selection Modal
 */
function MaterialReadinessModal({
  isOpen,
  onClose,
  currentReadiness,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentReadiness: string;
  onSelect: (readiness: string) => void;
}) {
  const readinessOptions = [
    { value: 'not_ready', label: 'Не обеспечен', description: 'Материалы не готовы к производству' },
    { value: 'partially_ready', label: 'Частично обеспечен', description: 'Часть материалов есть, часть нужно закупить' },
    { value: 'ready', label: 'Обеспечен материалами', description: 'Все материалы готовы к производству' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Изменить готовность материалов</SheetTitle>
          <SheetDescription>
            Укажите текущий статус обеспеченности материалами для производства
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          {readinessOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onSelect(option.value)}
              className={`w-full text-left p-4 border rounded-lg transition-colors ${
                currentReadiness === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="font-medium">{option.label}</div>
              <div className="text-sm text-slate-500">{option.description}</div>
            </button>
          ))}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Installer/Handover Section - Shows installation and handover info
 */
function InstallerHandoverSection({
  address,
  customer,
  orderItems,
  itemsCount,
  handoverStage,
  handoverStageLabel,
  balanceDue,
  paymentState,
  warnings,
  orderId,
  onHandoverStageChanged,
  photoReportStatus,
  photoReportCount,
  photoReports,
  completionActStatus,
  completionActAvailable,
  completionAct,
}: {
  address: {
    city?: string;
    street?: string;
    building?: string;
    apartment?: string;
    notes?: string;
  } | null;
  customer: { id: string; name: string; phone: string };
  orderItems: Array<{
    id: string;
    room_name: string | null;
    window_name: string | null;
    description: string | null;
    fabric: string | null;
    fabric_name?: string | null;
    quantity: number;
    width_cm: number | null;
    height_cm: number | null;
  }>;
  itemsCount: number;
  handoverStage: string;
  handoverStageLabel: string;
  balanceDue: number;
  paymentState: 'paid' | 'partial' | 'unpaid';
  warnings: WarningDTO[];
  orderId: string;
  onHandoverStageChanged: () => void;
  photoReportStatus: PhotoReportStatus;
  photoReportCount: number;
  photoReports: PhotoReportSummaryDTO[];
  completionActStatus: CompletionActStatus;
  completionActAvailable: boolean;
  completionAct?: CompletionActSummaryDTO;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const photoReportsQuery = useOrderPhotoReports(orderId);
  const uploadMutation = useUploadOrderPhotoReport(orderId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const changeStageMutation = useChangeHandoverStage();

  // Completion Act (AVR) hooks
  const completionActQuery = useOrderCompletionAct(orderId);
  const createActMutation = useCreateOrderCompletionAct();
  const uploadActMutation = useUploadSignedCompletionAct();
  const [actUploadError, setActUploadError] = useState<string | null>(null);
  const [selectedActFile, setSelectedActFile] = useState<File | null>(null);
  const [actNotes, setActNotes] = useState('');

  const isDone = handoverStage === 'done';
  const isPending = handoverStage === 'pending';
  const isScheduled = handoverStage === 'scheduled';
  const isInProgress = handoverStage === 'in_progress';
  const canComplete = isDone && balanceDue <= 0;

  const handleSchedule = async () => {
    try {
      setError(null);
      await changeStageMutation.mutateAsync({
        orderId,
        data: { handover_stage: 'scheduled' },
      });
      onHandoverStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при планировании');
    }
  };

  const handleStart = async () => {
    try {
      setError(null);
      await changeStageMutation.mutateAsync({
        orderId,
        data: { handover_stage: 'in_progress' },
      });
      onHandoverStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при начале установки');
    }
  };

  const handleDone = async () => {
    try {
      setError(null);
      await changeStageMutation.mutateAsync({
        orderId,
        data: { handover_stage: 'done' },
      });
      onHandoverStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при завершении установки');
    }
  };

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'done':
        return 'bg-green-100 text-green-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <Card className="border-l-4 border-l-indigo-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Установка / Выдача
          </CardTitle>
          <span className={`text-xs px-2 py-1 rounded-full ${getStageBadgeClass(handoverStage)}`}>
            {handoverStageLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Warnings */}
        {warnings.map((warning, idx) => (
          <Alert
            key={idx}
            variant={warning.severity === 'error' ? 'destructive' : 'default'}
            className={
              warning.severity === 'warning'
                ? 'bg-yellow-50 border-yellow-200'
                : warning.severity === 'error'
                ? 'bg-red-50 border-red-200'
                : undefined
            }
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{warning.message}</AlertDescription>
          </Alert>
        ))}

        {/* Customer & Address */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Клиент:</span>
            <span className="font-medium">{customer.name}</span>
          </div>
          {customer.phone && (
            <div className="flex justify-between">
              <span className="text-slate-600">Телефон:</span>
              <span>{customer.phone}</span>
            </div>
          )}
          {address && (
            <div className="flex justify-between">
              <span className="text-slate-600">Адрес:</span>
              <span className="text-right">
                {[address.city, address.street, address.building, address.apartment]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Payment Status */}
        <div className="flex items-center justify-between text-sm py-2 border-t border-slate-100">
          <span className="text-slate-600">Оплата:</span>
          <div className="flex items-center gap-2">
            {paymentState === 'paid' ? (
              <span className="text-green-600 font-medium">Оплачено полностью</span>
            ) : paymentState === 'partial' ? (
              <>
                <span className="text-yellow-600">Частичная оплата</span>
                {balanceDue > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                    Остаток: {balanceDue}
                  </span>
                )}
              </>
            ) : (
              <span className="text-red-600">Не оплачено</span>
            )}
          </div>
        </div>

        {/* Items to Install */}
        {itemsCount > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Изделия для установки ({itemsCount}):</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {orderItems.map((item) => {
                // Get safe fabric label - never shows UUID
                const fabricLabel = getFabricLabel(item);
                
                return (
                <div key={item.id} className="text-sm p-2 bg-slate-50 rounded">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {item.room_name || '—'} — {item.window_name || '—'}
                    </span>
                    <span className="text-slate-500">×{item.quantity}</span>
                  </div>
                  {item.description && (
                    <div className="text-slate-600 text-xs mt-1">{item.description}</div>
                  )}
                  <div className="text-slate-500 text-xs">Ткань: {fabricLabel || 'не указана'}</div>
                  {(item.width_cm || item.height_cm) && (
                    <div className="text-slate-500 text-xs">
                      Размеры: {item.width_cm || '—'}×{item.height_cm || '—'} см
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Alert className="bg-slate-50 border-slate-200">
            <Info className="h-4 w-4 text-slate-600" />
            <AlertDescription className="text-slate-700">
              Нет изделий для установки. Сначала сформируйте позиции заказа из КП.
            </AlertDescription>
          </Alert>
        )}

        {/* Photo Report Section */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Фотоотчёт:</span>
            {photoReportStatus === 'uploaded' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                Загружено: {photoReportCount}
              </span>
            ) : photoReportStatus === 'not_uploaded' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                Не загружен
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                Недоступен
              </span>
            )}
          </div>

          {/* Upload Error */}
          {uploadError && (
            <Alert variant="destructive" className="text-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* Photo List */}
          {photoReports.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {photoReports.map((photo) => {
                const resolvedUrl = resolveMediaUrl(photo.file_url);
                return (
                  <div key={photo.id} className="border rounded-lg p-2 space-y-2">
                    {resolvedUrl ? (
                      <img
                        src={resolvedUrl}
                        alt={photo.caption || 'Фото отчёт'}
                        className="w-full h-32 object-cover rounded border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-32 bg-slate-100 rounded flex flex-col items-center justify-center text-slate-400 text-sm border">
                        <Camera className="h-5 w-5 mb-1" />
                        <span>Фото недоступно</span>
                      </div>
                    )}
                    {photo.caption && (
                      <p className="text-xs text-slate-600">{photo.caption}</p>
                    )}
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{photo.uploaded_by_name || '—'}</span>
                      <span>{formatDateTime(photo.uploaded_at)}</span>
                    </div>
                    {resolvedUrl && (
                      <a
                        href={resolvedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Открыть фото
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload UI - only when handover is done */}
          {photoReportStatus !== 'not_available' && (
            <div className="space-y-2">
              <input
                id="photo-report-file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Textarea
                id="photo-report-caption"
                name="caption"
                placeholder="Комментарий к фото (опционально)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="text-sm min-h-[60px]"
              />
              <Button
                onClick={async () => {
                  if (!selectedFile) {
                    setUploadError('Выберите файл для загрузки');
                    return;
                  }
                  try {
                    setUploadError(null);
                    const formData = new FormData();
                    formData.append('file', selectedFile);
                    if (caption) formData.append('caption', caption);
                    await uploadMutation.mutateAsync(formData);
                    setSelectedFile(null);
                    setCaption('');
                    photoReportsQuery.refetch();
                  } catch (err: unknown) {
                    const errorData = err as { detail?: string; code?: string };
                    setUploadError(errorData.detail || 'Ошибка при загрузке фото');
                  }
                }}
                disabled={!selectedFile || uploadMutation.isPending}
                className="w-full"
                variant="outline"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    {photoReports.length > 0 ? 'Добавить ещё фото' : 'Загрузить фото'}
                  </>
                )}
              </Button>
            </div>
          )}

          {photoReportStatus === 'not_available' && (
            <Alert className="bg-slate-50 border-slate-200 text-sm">
              <Info className="h-4 w-4 text-slate-600" />
              <AlertDescription className="text-slate-600">
                Фотоотчёт доступен после установки / выдачи
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Completion Act (АВР) Section */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">АВР (акт выполненных работ):</span>
            {completionActStatus === 'signed' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                Подписан
              </span>
            ) : completionActStatus === 'draft' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                Черновик
              </span>
            ) : completionActStatus === 'not_available' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                Недоступен
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                Не создан
              </span>
            )}
          </div>

          {/* Upload Error */}
          {actUploadError && (
            <Alert variant="destructive" className="text-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{actUploadError}</AlertDescription>
            </Alert>
          )}

          {/* Act Details */}
          {completionAct && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Номер АВР:</span>
                <span className="font-medium">{completionAct.act_number}</span>
              </div>
              {completionAct.signed_file_url && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Подписан:</span>
                    <span>{formatDateTime(completionAct.signed_at ?? null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Кем загружен:</span>
                    <span>{completionAct.signed_file_uploaded_by_name || '—'}</span>
                  </div>
                  <a
                    href={resolveMediaUrl(completionAct.signed_file_url) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline block mt-2"
                  >
                    Открыть подписанный АВР
                  </a>
                </>
              )}
              {completionAct.notes && (
                <p className="text-xs text-slate-600 mt-2">{completionAct.notes}</p>
              )}
            </div>
          )}

          {/* Create Act Button */}
          {completionActStatus === 'not_created' && completionActAvailable && (
            <Button
              onClick={async () => {
                try {
                  setActUploadError(null);
                  await createActMutation.mutateAsync(orderId);
                  completionActQuery.refetch();
                } catch (err: unknown) {
                  const errorData = err as { detail?: string; code?: string };
                  setActUploadError(errorData.detail || 'Ошибка при создании АВР');
                }
              }}
              disabled={createActMutation.isPending}
              className="w-full"
              variant="outline"
            >
              {createActMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Создать АВР
                </>
              )}
            </Button>
          )}

          {/* Upload Signed Act */}
          {completionActAvailable && completionActStatus !== 'not_available' && (
            <div className="space-y-2">
              <input
                id="act-file"
                name="signed_file"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setSelectedActFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Textarea
                id="act-notes"
                name="notes"
                placeholder="Примечания к АВР (опционально)"
                value={actNotes}
                onChange={(e) => setActNotes(e.target.value)}
                className="text-sm min-h-[60px]"
              />
              <Button
                onClick={async () => {
                  if (!selectedActFile) {
                    setActUploadError('Выберите файл для загрузки');
                    return;
                  }
                  try {
                    setActUploadError(null);
                    const formData = new FormData();
                    formData.append('signed_file', selectedActFile);
                    if (actNotes) formData.append('notes', actNotes);
                    await uploadActMutation.mutateAsync({ orderId, formData });
                    setSelectedActFile(null);
                    setActNotes('');
                    completionActQuery.refetch();
                  } catch (err: unknown) {
                    const errorData = err as { detail?: string; code?: string };
                    setActUploadError(errorData.detail || 'Ошибка при загрузке АВР');
                  }
                }}
                disabled={!selectedActFile || uploadActMutation.isPending}
                className="w-full"
                variant={completionActStatus === 'signed' ? 'outline' : 'default'}
              >
                {uploadActMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Загрузка...
                  </>
                ) : completionActStatus === 'signed' ? (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Заменить подписанный АВР
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Загрузить подписанный АВР
                  </>
                )}
              </Button>
            </div>
          )}

          {completionActStatus === 'not_available' && (
            <Alert className="bg-slate-50 border-slate-200 text-sm">
              <Info className="h-4 w-4 text-slate-600" />
              <AlertDescription className="text-slate-600">
                АВР доступен после установки / выдачи
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {!isDone && itemsCount > 0 && (
            <>
              {isPending && (
                <Button onClick={handleSchedule} disabled={changeStageMutation.isPending} className="w-full">
                  {changeStageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4 mr-2" />
                  )}
                  Запланировать
                </Button>
              )}
              {(isScheduled || isPending) && (
                <Button
                  onClick={handleStart}
                  disabled={changeStageMutation.isPending}
                  variant="default"
                  className="w-full"
                >
                  {changeStageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Начать установку / выдачу
                </Button>
              )}
              {isInProgress && (
                <Button
                  onClick={handleDone}
                  disabled={changeStageMutation.isPending}
                  variant="default"
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {changeStageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Отметить установлено / передано
                </Button>
              )}
            </>
          )}

          {isDone && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Установка / выдача завершена
                {balanceDue > 0 && '. Ожидается финальная оплата.'}
              </AlertDescription>
            </Alert>
          )}

          {canComplete && (
            <Alert className="bg-blue-50 border-blue-200">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Заказ можно завершить — все работы выполнены и оплата получена.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Production/Sewing Section - Shows what to sew for production role
 */
function ProductionSewingSection({
  itemsToSew,
  productionStage,
  deadline,
  assignment,
  materialReadiness,
  orderId,
  onProductionStageChanged,
  fallbackMaterials,
  fallbackMeasurements,
  orderItems,
  orderStatus,
  hasApprovedQuote,
  onGenerate,
}: {
  itemsToSew: ProductionItemDTO[];
  productionStage: string;
  deadline: string | null;
  assignment: ProductionAssignmentDTO | null;
  materialReadiness: string;
  orderId: string;
  onProductionStageChanged: () => void;
  fallbackMaterials?: SelectedMaterialDTO[];
  fallbackMeasurements?: DesignerMeasurementDTO[];
  orderItems?: OrderItemDTO[];
  orderStatus?: string;
  hasApprovedQuote?: boolean;
  onGenerate?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const changeStageMutation = useChangeProductionStage();
  const changeStatusMutation = useChangeOrderStatus();
  const generateItemsMutation = useGenerateOrderItems();

  // MVP: Only show not_started, sewing, done in correction modal
  // Hide cutting, quality_check, rework
  const CORRECTION_STAGES = [
    { value: 'not_started', label: 'Не начато' },
    { value: 'sewing', label: 'Пошив' },
    { value: 'done', label: 'Готово' },
  ];

  // Check if user can correct production stage
  const canCorrectStage = orderStatus && ['in_production', 'ready'].includes(orderStatus);

  // Handle stage correction
  const handleStageCorrection = async (newStage: string) => {
    try {
      setError(null);
      await changeStageMutation.mutateAsync({
        orderId,
        data: { production_stage: newStage },
      });
      setIsCorrectionModalOpen(false);
      onProductionStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при изменении этапа');
    }
  };

  // Map production_stage to simple seamstress state
  const getSeamstressState = (stage: string): { label: string; color: string; bg: string } => {
    switch (stage) {
      case 'not_started':
        return { label: 'Ожидает', color: 'text-slate-600', bg: 'bg-slate-100' };
      case 'cutting':
      case 'sewing':
        return { label: 'В работе', color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'quality_check':
        return { label: 'Проверка', color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'done':
        return { label: 'Готово', color: 'text-green-600', bg: 'bg-green-50' };
      default:
        return { label: 'Ожидает', color: 'text-slate-600', bg: 'bg-slate-100' };
    }
  };

  // Calculate overdue
  const getOverdueInfo = (): { isOverdue: boolean; days: number; text: string } | null => {
    if (!deadline || productionStage === 'done') return null;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = today.getTime() - deadlineDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return {
        isOverdue: true,
        days: diffDays,
        text: diffDays === 1 ? 'Просрочен 1 день' : `Просрочен ${diffDays} дней`,
      };
    }
    return null;
  };

  const seamstressState = getSeamstressState(productionStage);
  const overdueInfo = getOverdueInfo();

  // Take order to work (new → in_work)
  const handleTakeToWork = async () => {
    try {
      setError(null);
      await changeStatusMutation.mutateAsync({
        orderId,
        data: { status: 'in_work' },
      });
      onProductionStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при взятии заказа в работу');
    }
  };

  // Transfer to production (in_work → in_production)
  const handleTransferToProduction = async () => {
    try {
      setError(null);
      await changeStatusMutation.mutateAsync({
        orderId,
        data: { status: 'in_production' },
      });
      onProductionStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при передаче в производство');
    }
  };

  // Start production (in_production → sewing)
  const handleStartProduction = async () => {
    try {
      setError(null);
      await changeStageMutation.mutateAsync({
        orderId,
        data: { production_stage: 'sewing' },
      });
      onProductionStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при начале пошива');
    }
  };

  const handleMarkDone = async () => {
    try {
      setError(null);
      await changeStageMutation.mutateAsync({
        orderId,
        data: { production_stage: 'done' },
      });
      onProductionStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при завершении работы');
    }
  };

  // Determine button states
  // Use orderItems if available, otherwise fall back to itemsToSew from execution summary
  const realOrderItems = orderItems || [];
  const hasRealItems = realOrderItems.length > 0;
  const hasItems = hasRealItems || itemsToSew.length > 0;
  
  // Can generate if: no items, has approved quote, status allows
  const canGenerate = !hasRealItems && hasApprovedQuote && 
    orderStatus && ['new', 'in_work'].includes(orderStatus);
  
  // Order status flow
  const isOrderNew = orderStatus === 'new';
  const isOrderInWork = orderStatus === 'in_work';
  const isOrderInProduction = orderStatus === 'in_production';
  
  // Button visibility logic - correct workflow:
  // new → in_work ("Взять заказ в работу")
  // in_work → in_production ("Передать в производство")
  // in_production + not_started → sewing ("Начать пошив")
  
  // Step 1: Order new + has items → show "Взять заказ в работу"
  const showTakeToWork = isOrderNew && hasItems;
  
  // Step 2: Order in_work + material ready + has items → show "Передать в производство"
  const canTransferToProduction = isOrderInWork && 
    materialReadiness !== 'not_ready' && 
    hasItems;
  
  // Step 3: Order in_production + production not started + material ready → show "Начать пошив"
  const canStartProduction = isOrderInProduction && 
    productionStage === 'not_started' && 
    materialReadiness !== 'not_ready' && 
    hasItems;
  
  // Step 4: Production started → show "Отметить готово"
  const showMarkDone = productionStage !== 'done' && productionStage !== 'not_started';
  
  const isMaterialNotReady = hasItems && materialReadiness === 'not_ready';
  const isDone = productionStage === 'done';

  const handleGenerate = async () => {
    try {
      setError(null);
      await generateItemsMutation.mutateAsync({ orderId });
      onGenerate?.();
      onProductionStageChanged();
    } catch (err: unknown) {
      const errorData = err as { detail?: string };
      setError(errorData.detail || 'Ошибка при генерации позиций');
    }
  };

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Пошив / Производство
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${seamstressState.bg} ${seamstressState.color}`}>
              {seamstressState.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Material Readiness Warning */}
        {isMaterialNotReady && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Материалы не обеспечены. Производство запускать нельзя.
            </AlertDescription>
          </Alert>
        )}

        {hasItems && materialReadiness === 'partially_ready' && productionStage === 'not_started' && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700">
              Материалы обеспечены частично. Можно начать с риском остановки.
            </AlertDescription>
          </Alert>
        )}

        {/* Deadline and Overdue */}
        {deadline && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Срок сдачи:</span>
            <div className="flex items-center gap-2">
              <span className={overdueInfo?.isOverdue ? 'text-red-600 font-medium' : 'text-slate-700'}>
                {formatDate(deadline)}
              </span>
              {overdueInfo && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                  {overdueInfo.text}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Assignment Info */}
        {assignment && (
          <div className="text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Назначено:</span>
              <span className="font-medium">{assignment.assigned_to || '—'}</span>
            </div>
          </div>
        )}

        {/* Items to Sew - Real OrderItems, Execution Items, or Fallback */}
        {(() => {
          // Build fallback items from designer data if items_to_sew is empty
          const fallbackItems: ProductionItemDTO[] = [];
          
          if (itemsToSew.length === 0 && fallbackMaterials && fallbackMaterials.length > 0) {
            fallbackMaterials.forEach((mat, index) => {
              fallbackItems.push({
                id: `fallback-mat-${index}`,
                room_name: mat.room || '—',
                window_name: null,
                description: mat.sewing_type || 'Пошив изделия',
                fabric_name: mat.fabric || null,
                tulle_name: null,
                fabric_meters: mat.fabric_meters || null,
                width_cm: null,
                height_cm: null,
                notes: null,
              });
            });
          }
          
          if (itemsToSew.length === 0 && fallbackMeasurements && fallbackMeasurements.length > 0) {
            fallbackMeasurements.forEach((m, index) => {
              // Check if this measurement is already covered by a material
              const existingIndex = fallbackItems.findIndex(item => 
                item.room_name === m.room_name
              );
              
              if (existingIndex >= 0) {
                // Add dimensions to existing item
                fallbackItems[existingIndex].width_cm = m.width_cm;
                fallbackItems[existingIndex].height_cm = m.height_cm;
                fallbackItems[existingIndex].window_name = m.window_name;
              } else {
                fallbackItems.push({
                  id: `fallback-meas-${index}`,
                  room_name: m.room_name || '—',
                  window_name: m.window_name || null,
                  description: m.mounting_type || 'Шторы',
                  fabric_name: null,
                  tulle_name: null,
                  fabric_meters: null,
                  width_cm: m.width_cm,
                  height_cm: m.height_cm,
                  notes: null,
                });
              }
            });
          }
          
          // Determine what to show: real OrderItems > execution items > fallback
          const isRealItems = hasRealItems;
          const displayItems = isRealItems 
            ? [] // Will render realOrderItems separately
            : itemsToSew.length > 0 
              ? itemsToSew 
              : fallbackItems;
          const isFallback = !isRealItems && itemsToSew.length === 0 && fallbackItems.length > 0;
          
          // Show Generate from Quote button when no real items but can generate
          if (!isRealItems && canGenerate) {
            return (
              <div className="space-y-3">
                <Alert className="bg-blue-50 border-blue-200">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    Есть принятое КП. Сформируйте позиции заказа для начала производства.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={handleGenerate} 
                  disabled={generateItemsMutation.isPending}
                  className="w-full"
                >
                  {generateItemsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Формируем...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Сформировать из КП
                    </>
                  )}
                </Button>
              </div>
            );
          }
          
          if (isRealItems) {
            // Render real OrderItems from order.items
            return (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-700">
                  Изделия к пошиву ({realOrderItems.length}):
                </h4>
                {realOrderItems.map((item, index) => {
                  // Parse room/window from notes (format: "Room / Window / sewing_type / ...")
                  const noteParts = item.notes?.split(' / ') || [];
                  const roomName = noteParts[0] || '—';
                  const windowName = noteParts[1] || null;
                  const sewingType = item.sewing_type || noteParts[2] || 'Пошив';
                  
                  // Get safe fabric label - never shows UUID
                  const fabricLabel = getFabricLabel(item);
                  
                  return (
                    <div key={item.id || index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-sm">{roomName}</div>
                          {windowName && windowName !== '—' && (
                            <div className="text-xs text-slate-500">{windowName}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-slate-700">{sewingType}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        {(item.window_width_cm || item.window_height_cm) && (
                          <div>Размеры: {item.window_width_cm || '—'}×{item.window_height_cm || '—'} см</div>
                        )}
                        {fabricLabel ? (
                          <div>Ткань: {fabricLabel}</div>
                        ) : (
                          <div>Ткань: не указана</div>
                        )}
                        {item.folds_count && (
                          <div>Складки: {item.folds_count}</div>
                        )}
                      </div>
                      {item.notes && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                          <span className="font-medium">Примечание:</span> {item.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }
          
          if (displayItems.length > 0) {
            return (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-700">
                  {isFallback ? 'Позиции из КП / замеров:' : 'Изделия к пошиву:'}
                </h4>
                {isFallback && (
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    Данные из замеров и выбранных материалов. Требуется формирование позиций заказа.
                  </div>
                )}
                {displayItems.map((item, index) => {
                  // Get safe fabric label - never shows UUID
                  const fabricLabel = getFabricLabel(item);
                  
                  return (
                  <div key={item.id || index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">{item.room_name || '—'}</div>
                        {item.window_name && (
                          <div className="text-xs text-slate-500">{item.window_name}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-slate-700">{item.description}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      {(item.width_cm || item.height_cm) && (
                        <div>Размеры: {item.width_cm || '—'}×{item.height_cm || '—'} см</div>
                      )}
                      <div>Ткань: {fabricLabel || 'не указана'}</div>
                      {item.tulle_name && (
                        <div>Тюль: {item.tulle_name}</div>
                      )}
                      {item.fabric_meters && (
                        <div>Метраж: {item.fabric_meters} м</div>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                        <span className="font-medium">Примечание:</span> {item.notes}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            );
          }
          
          // Only show empty state if no items and no fallback data
          return (
            <EmptyState
              title="Нет изделий к пошиву"
              description="Добавьте замеры или позиции КП"
              icon={<Scissors className="h-6 w-6 text-slate-400" />}
            />
          );
        })()}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {isDone ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Производство завершено. Ожидает сдачи заказа.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Show message if no items to sew */}
              {!hasItems && productionStage === 'not_started' && (
                <Alert className="bg-slate-50 border-slate-200">
                  <Info className="h-4 w-4 text-slate-600" />
                  <AlertDescription className="text-slate-700">
                    Сначала сформируйте позиции заказа из КП
                  </AlertDescription>
                </Alert>
              )}

              {/* Step 1: Take order to work (new → in_work) */}
              {showTakeToWork && (
                <Button
                  onClick={handleTakeToWork}
                  disabled={changeStatusMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {changeStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Взятие в работу...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Взять заказ в работу
                    </>
                  )}
                </Button>
              )}

              {/* Step 2: Transfer to production (in_work → in_production) */}
              {canTransferToProduction && (
                <Button
                  onClick={handleTransferToProduction}
                  disabled={changeStatusMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {changeStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Передача в производство...
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 mr-2" />
                      Передать в производство
                    </>
                  )}
                </Button>
              )}

              {/* Step 3: Start sewing (in_production → sewing) */}
              {canStartProduction && (
                <Button
                  onClick={handleStartProduction}
                  disabled={changeStageMutation.isPending}
                  className="w-full"
                >
                  {changeStageMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Начинаем пошив...
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 mr-2" />
                      Начать пошив
                    </>
                  )}
                </Button>
              )}

              {/* Step 4: Mark production done */}
              {showMarkDone && (
                <Button
                  onClick={handleMarkDone}
                  disabled={changeStageMutation.isPending}
                  variant="default"
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {changeStageMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Завершаем...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Отметить готово
                    </>
                  )}
                </Button>
              )}

              {/* Placeholder for problem reporting */}
              <Button
                variant="outline"
                className="w-full"
                disabled
                title="Будет добавлено позже"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Сообщить проблему — будет добавлено позже
              </Button>
            </>
          )}
        </div>

        {/* Production stage correction - MVP: only not_started/sewing/done */}
        {/* Moved outside isDone conditional to allow correction even when done */}
        {canCorrectStage && (
          <div className="pt-2">
            <Button
              onClick={() => setIsCorrectionModalOpen(true)}
              disabled={changeStageMutation.isPending}
              variant="outline"
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Изменить этап производства
            </Button>
          </div>
        )}

        {/* Production Stage Correction Modal - MVP */}
        <Dialog open={isCorrectionModalOpen} onOpenChange={setIsCorrectionModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Изменить этап производства</DialogTitle>
              <DialogDescription>
                Выберите новый этап. Доступны только основные этапы для MVP.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {CORRECTION_STAGES.map((stage) => (
                <Button
                  key={stage.value}
                  onClick={() => handleStageCorrection(stage.value)}
                  disabled={productionStage === stage.value || changeStageMutation.isPending}
                  variant={productionStage === stage.value ? "default" : "outline"}
                  className={productionStage === stage.value ? "bg-blue-600" : ""}
                >
                  {stage.label}
                  {productionStage === stage.value && (
                    <span className="ml-2 text-xs">(текущий)</span>
                  )}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCorrectionModalOpen(false)}>
                Отмена
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/**
 * Measurement Form Modal - Sheber Design
 */
function MeasurementModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MeasurementFormData) => void;
  title: string;
  initialData?: Partial<MeasurementFormData>;
}) {
  // Phase 3: Form with curtain and tulle fabrics
  const [formData, setFormData] = useState<MeasurementFormData>({
    room_name: initialData?.room_name || '',
    window_name: initialData?.window_name || '',
    width_cm: initialData?.width_cm || 0,
    height_cm: initialData?.height_cm || 0,
    depth_cm: initialData?.depth_cm,
    mounting_type: initialData?.mounting_type || '',
    // Phase 3: Fabric fields
    curtain_fabric: initialData?.curtain_fabric || null,
    curtain_meters: initialData?.curtain_meters || 0,
    tulle_fabric: initialData?.tulle_fabric || null,
    tulle_meters: initialData?.tulle_meters || 0,
    notes: initialData?.notes || '',
  });

  // Fetch fabrics for selection
  const { data: fabricsData } = useFabrics({ pageSize: 100 });
  const fabrics = fabricsData?.results || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_name || formData.width_cm <= 0 || formData.height_cm <= 0) {
      return;
    }
    // Phase 3: Submit with fabric fields
    onSubmit({
      ...formData,
      selected_fabric: null, // Legacy field - always null
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        className="sm:max-w-lg bg-[var(--card-sheber)] border-[var(--border-sheber)]"
        style={{ borderRadius: 'var(--rl)' }}
      >
        <SheetHeader className="pb-4 border-b border-[var(--border-sheber)]">
          <SheetTitle className="text-[var(--t1)] text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-5">
          {/* Room & Window in one row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Комната *</label>
              <input
                type="text"
                value={formData.room_name}
                onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-[var(--input-bg)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                placeholder="Гостиная"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Окно / изделие *</label>
              <input
                type="text"
                value={formData.window_name}
                onChange={(e) => setFormData({ ...formData, window_name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-[var(--input-bg)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                placeholder="Окно 1"
                required
              />
            </div>
          </div>

          {/* Dimensions in one row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Ширина (см) *</label>
              <input
                type="number"
                value={formData.width_cm || ''}
                onChange={(e) => setFormData({ ...formData, width_cm: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm bg-[var(--input-bg)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                min={1}
                max={1000}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Высота (см) *</label>
              <input
                type="number"
                value={formData.height_cm || ''}
                onChange={(e) => setFormData({ ...formData, height_cm: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm bg-[var(--input-bg)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                min={1}
                max={500}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Глубина (см)</label>
              <input
                type="number"
                value={formData.depth_cm || ''}
                onChange={(e) => setFormData({ ...formData, depth_cm: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 text-sm bg-[var(--input-bg)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                min={0}
                max={100}
                placeholder="—"
              />
            </div>
          </div>

          {/* Curtain Fabric + Meters in one row */}
          <div className="space-y-2 p-3 bg-[var(--bg)] rounded-[var(--rl)] border border-[var(--borderl)]">
            <div className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Ткань штор + метры</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[var(--t3)]">Ткань</label>
                <select
                  value={formData.curtain_fabric || "__none__"}
                  onChange={(e) => setFormData({ ...formData, curtain_fabric: e.target.value === "__none__" ? null : e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--card-sheber)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                >
                  <option value="__none__">Не выбрана</option>
                  {fabrics.map((fabric) => (
                    <option key={fabric.id} value={fabric.id}>
                      {fabric.hanger_number} — {fabric.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--t3)]">Метры</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.curtain_meters || ''}
                  onChange={(e) => setFormData({ ...formData, curtain_meters: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm bg-[var(--card-sheber)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Tulle Fabric + Meters in one row */}
          <div className="space-y-2 p-3 bg-[var(--bg)] rounded-[var(--rl)] border border-[var(--borderl)]">
            <div className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Ткань тюля + метры</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[var(--t3)]">Ткань</label>
                <select
                  value={formData.tulle_fabric || "__none__"}
                  onChange={(e) => setFormData({ ...formData, tulle_fabric: e.target.value === "__none__" ? null : e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--card-sheber)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                >
                  <option value="__none__">Не выбрана</option>
                  {fabrics.map((fabric) => (
                    <option key={fabric.id} value={fabric.id}>
                      {fabric.hanger_number} — {fabric.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--t3)]">Метры</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.tulle_meters || ''}
                  onChange={(e) => setFormData({ ...formData, tulle_meters: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm bg-[var(--card-sheber)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Тип крепления</label>
            <select
              value={formData.mounting_type}
              onChange={(e) => setFormData({ ...formData, mounting_type: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[var(--input-bg)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
            >
              <option value="">—</option>
              <option value="ceiling">Потолок</option>
              <option value="wall">Стена</option>
              <option value="niche">Ниша</option>
              <option value="window_recess">Оконный проём</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Примечание</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[var(--input-bg)] border border-[var(--border-sheber)] rounded-[var(--r)] text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:ring-2 focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
              placeholder="Дополнительные детали..."
            />
          </div>

          <SheetFooter className="flex-col sm:flex-row gap-2 pt-5 border-t border-[var(--border-sheber)]">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="border-[var(--border-sheber)] text-[var(--t2)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
            >
              Отмена
            </Button>
            <Button 
              type="submit"
              className="bg-[var(--a)] hover:bg-[var(--ad)] text-white"
            >
              Сохранить
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Production Stage Selection Modal
 */
function ProductionStageModal({
  isOpen,
  onClose,
  orderId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}) {
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const changeProductionMutation = useChangeProductionStage();

  const stages = [
    { value: 'not_started', label: 'Не начато' },
    { value: 'cutting', label: 'Раскрой' },
    { value: 'sewing', label: 'Пошив' },
    { value: 'quality_check', label: 'Контроль качества' },
    { value: 'done', label: 'Производство завершено' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStage) return;

    try {
      await changeProductionMutation.mutateAsync({
        orderId,
        data: { production_stage: selectedStage as 'not_started' | 'cutting' | 'sewing' | 'quality_check' | 'done' },
      });
      setSuccessMessage('Этап производства обновлён');
      setTimeout(() => {
        setSuccessMessage(null);
        onSuccess();
      }, 1000);
    } catch (err) {
      console.error('Failed to update production stage:', err);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Изменить этап производства</SheetTitle>
          <SheetDescription>
            Выберите текущий этап производства заказа
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {successMessage && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {stages.map((stage) => (
              <label
                key={stage.value}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedStage === stage.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="production_stage"
                  value={stage.value}
                  checked={selectedStage === stage.value}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="mr-3"
                />
                <span className="text-sm font-medium">{stage.label}</span>
              </label>
            ))}
          </div>

          <SheetFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={!selectedStage || changeProductionMutation.isPending}>
              {changeProductionMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [productionStageModalOpen, setProductionStageModalOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Guard: detect when literal [id] or placeholder is in URL
  const isPlaceholderId =
    !orderId ||
    orderId === '[id]' ||
    orderId === '%5Bid%5D' ||
    (orderId.startsWith('[') && orderId.endsWith(']'));
  if (isPlaceholderId) {
    return (
      <>
        <PageHeader title="Ошибка навигации" description="Некорректный ID заказа">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказам
            </Link>
          </Button>
        </PageHeader>
        <ErrorState
          title="Некорректный ID заказа"
          description={`Обнаружен неверный идентификатор: "${orderId}". Убедитесь, что вы перешли по ссылке с реальным ID заказа.`}
        />
      </>
    );
  }

  // Fetch order detail and execution data
  const {
    data: order,
    isLoading: isOrderLoading,
    isError: isOrderError,
    error: orderError,
  } = useOrder(orderId || null);
  const {
    data: execution,
    isLoading: isExecutionLoading,
    refetch: refetchExecution,
  } = useOrderExecution(orderId || null);

  // Action mutations
  const changeStatusMutation = useChangeOrderStatus();
  const changeMaterialMutation = useChangeMaterialReadiness();
  const changeProductionMutation = useChangeProductionStage();
  const changeHandoverMutation = useChangeHandoverStage();
  const cancelMutation = useCancelOrder();
  const generateItemsMutation = useGenerateOrderItems();

  const isLoading = isOrderLoading || isExecutionLoading;

  // Handle action button click
  const handleAction = async (action: AvailableActionDTO) => {
    setActionError(null);
    try {
      switch (action.action) {
        case 'change_status':
          if (action.target_status) {
            await changeStatusMutation.mutateAsync({
              orderId,
              data: { status: action.target_status as OrderStatus },
            });
          }
          break;
        case 'change_material_readiness':
          // Show modal or direct action depending on UX choice
          await changeMaterialMutation.mutateAsync({
            orderId,
            data: { material_readiness: 'ready' },
          });
          break;
        case 'change_production_stage':
          // Open modal to select production stage
          setProductionStageModalOpen(true);
          return; // Don't refetch yet, wait for modal
        case 'change_handover_stage':
          await changeHandoverMutation.mutateAsync({
            orderId,
            data: { handover_stage: 'done' },
          });
          break;
        // Handle transition actions from backend
        case 'transition_to_ready':
          await changeStatusMutation.mutateAsync({
            orderId,
            data: { status: 'ready' },
          });
          break;
        case 'transition_to_in_work':
          await changeStatusMutation.mutateAsync({
            orderId,
            data: { status: 'in_work' },
          });
          break;
        case 'transition_to_in_production':
          await changeStatusMutation.mutateAsync({
            orderId,
            data: { status: 'in_production' },
          });
          break;
        case 'transition_to_on_installation':
          await changeStatusMutation.mutateAsync({
            orderId,
            data: { status: 'on_installation' },
          });
          break;
        case 'transition_to_waiting_final_payment':
          await changeStatusMutation.mutateAsync({
            orderId,
            data: { status: 'waiting_final_payment' },
          });
          break;
        case 'transition_to_completed':
          await changeStatusMutation.mutateAsync({
            orderId,
            data: { status: 'completed' },
          });
          break;
        case 'transition_to_new':
          await changeStatusMutation.mutateAsync({
            orderId,
            data: { status: 'new' },
          });
          break;
        default:
          break;
      }
      await refetchExecution();
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string; code?: string } } };
      const detail = error.response?.data?.detail || 'Произошла ошибка';
      const code = error.response?.data?.code || 'unknown_error';

      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        material_not_ready: 'Нельзя начать производство: материалы не обеспечены.',
        completed_order: 'Нельзя изменить завершённый заказ.',
        already_cancelled: 'Заказ уже отменён.',
        reason_required: 'Необходимо указать причину.',
        production_not_done: 'Производство ещё не завершено.',
        payment_required: 'Требуется оплата перед завершением.',
        cancelled_order: 'Нельзя изменить отменённый заказ.',
      };

      setActionError(errorMessages[code] || detail);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setActionError('Укажите причину отмены');
      return;
    }
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({
        orderId,
        data: { reason: cancelReason },
      });
      setCancelModalOpen(false);
      setCancelReason('');
      await refetchExecution();
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string; code?: string } } };
      const detail = error.response?.data?.detail || 'Не удалось отменить заказ';
      setActionError(detail);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader title={`Заказ ${orderId}`} description="Загрузка деталей заказа...">
          <Button variant="outline" disabled>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
        </PageHeader>
        <LoadingState message="Загрузка деталей заказа..." />
      </>
    );
  }

  // Error state
  if (isOrderError) {
    return (
      <>
        <PageHeader title={`Заказ ${orderId}`} description="Ошибка загрузки заказа">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказам
            </Link>
          </Button>
        </PageHeader>

        <ErrorState
          title="Не удалось загрузить заказ"
          description={orderError?.message || 'Что-то пошло не так. Попробуйте позже.'}
        />
      </>
    );
  }

  // Not found state
  if (!order) {
    return (
      <>
        <PageHeader title="Заказ не найден" description="Запрашиваемый заказ не найден">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказам
            </Link>
          </Button>
        </PageHeader>

        <EmptyState
          title="Заказ не найден"
          description={`Заказ с ID "${orderId}" не существует или был удален.`}
          icon={<Package className="h-6 w-6 text-slate-600" />}
          action={{
            label: 'К заказам',
            onClick: () => (window.location.href = '/orders'),
          }}
        />
      </>
    );
  }

  const customerData = typeof order.customer === 'object' ? order.customer : null;
  const customerId = customerData?.id || (typeof order.customer === 'string' ? order.customer : '');
  const customerName = customerData?.full_name || 'Клиент не указан';
  const customerPhone = customerData?.phone || 'Телефон не указан';
  const installationAddress = [
    order.installation_address_city,
    order.installation_address_street,
    order.installation_address_building,
    order.installation_address_apartment ? `кв. ${order.installation_address_apartment}` : null,
  ].filter(Boolean).join(', ') || 'Адрес не указан';
  const hasMeasurements = (order.measurements || []).length > 0;
  const hasQuotes = Boolean(order.source_quote) || Boolean(order.related_quotes?.length);
  const hasOrderItems = order.items.length > 0;
  const isEmptyOrderWorkflow = !hasMeasurements && !hasQuotes && !hasOrderItems;

  // Data state
  return (
    <>
      <PageHeader
        title={order.order_number}
        description={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            <span className="text-slate-500">• Создан {formatDate(order.created_at)}</span>
            {execution?.is_overdue && (
              <span className="text-red-600 text-sm font-medium">• Просрочен</span>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказам
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/measurements?order=${order.id}`}>
              <Ruler className="mr-2 h-4 w-4" />
              Замер
            </Link>
          </Button>
          {customerId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/estimate?customer=${customerId}&order=${order.id}`}>
                <Calculator className="mr-2 h-4 w-4" />
                КП
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/payments?order=${order.id}`}>
              <CreditCard className="mr-2 h-4 w-4" />
              Платеж
            </Link>
          </Button>
        </div>
      </PageHeader>

      <Card className="mb-6 border-slate-200 bg-white shadow-sm">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Клиент</div>
              <div className="mt-1 font-semibold text-slate-900">{customerName}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Телефон</div>
              <div className="mt-1 text-slate-900">{customerPhone}</div>
            </div>
            <div className="sm:col-span-2 xl:col-span-1">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Адрес</div>
              <div className="mt-1 text-slate-900">{installationAddress}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Дедлайн</div>
              <div className="mt-1 text-slate-900">{formatDate(order.planned_completion)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Следующий шаг</div>
              <div className="mt-1 text-slate-900">
                {execution?.next_step?.description || 'Определите следующий этап'}
              </div>
            </div>
          </div>
          {order.installation_address_notes && (
            <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {order.installation_address_notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action error */}
      {actionError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Warnings and Blockers */}
          {execution && (
            <WarningsSection
              warnings={execution.warnings}
              blockers={execution.blocking_reasons}
            />
          )}

          {isEmptyOrderWorkflow && (
            <Card className="border-dashed border-slate-300 bg-slate-50/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Что сделать дальше</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {[
                    'Добавьте замер',
                    'Создайте КП',
                    'Примите КП',
                    'Сформируйте позиции',
                    'Запустите исполнение',
                  ].map((step, index) => (
                    <div key={step} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                        {index + 1}
                      </div>
                      <div className="font-medium text-slate-800">{step}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Designer/Measurer Section - Shows measurements and materials */}
          {execution?.role_sections?.designer && (
            <DesignerMeasurerSection
              measurements={execution.role_sections.designer.measurements}
              roomsCount={execution.role_sections.designer.rooms_count}
              windowsCount={execution.role_sections.designer.windows_count}
              selectedMaterials={execution.role_sections.designer.selected_materials}
              quoteItemsCount={execution.role_sections.designer.quote_items_count}
              orderId={order.id}
              onMeasurementCreated={refetchExecution}
            />
          )}

          {/* Quote context stays next to measurements, not in a legacy tail */}
          <RelatedQuotesSection order={order} />

          {/* Warehouse Materials Section - Material requirements for warehouse role */}
          {execution?.role_sections?.warehouse && (
            <WarehouseMaterialsSection
              materialRequirements={execution.role_sections.warehouse.material_requirements}
              materialReadiness={execution.role_sections.warehouse.material_readiness}
              materialReadinessLabel={execution.role_sections.warehouse.material_readiness_label}
              missingMaterials={execution.role_sections.warehouse.missing_materials}
              missingMaterialsCount={execution.role_sections.warehouse.missing_materials_count}
              totalFabricsRequired={execution.role_sections.warehouse.total_fabrics_required}
              orderId={order.id}
              onMaterialReadinessChanged={refetchExecution}
              quoteMaterials={execution?.role_sections?.designer?.selected_materials}
              hasOrderItems={order.items.length > 0}
              onGenerate={refetchExecution}
            />
          )}

          {/* Production/Sewing Section - What to sew for production role */}
          {execution?.role_sections?.production && (
            <ProductionSewingSection
              itemsToSew={execution.role_sections.production.items_to_sew}
              productionStage={execution.role_sections.production.production_stage}
              deadline={execution.role_sections.production.deadline}
              assignment={execution.role_sections.production.production_assignment}
              materialReadiness={execution.role_sections.warehouse?.material_readiness || 'not_ready'}
              orderId={order.id}
              onProductionStageChanged={refetchExecution}
              fallbackMaterials={execution?.role_sections?.designer?.selected_materials}
              fallbackMeasurements={execution?.role_sections?.designer?.measurements}
              orderItems={order.items}
              orderStatus={order.status}
              hasApprovedQuote={
                order.source_quote?.status === 'approved' || 
                order.related_quotes?.some(q => q.status === 'approved') || 
                false
              }
              onGenerate={refetchExecution}
            />
          )}

          {/* Installer/Handover Section - Installation and handover */}
          {execution?.role_sections?.installer && (
            <InstallerHandoverSection
              address={execution.role_sections.installer.address}
              customer={execution.role_sections.installer.customer}
              orderItems={execution.role_sections.installer.order_items}
              itemsCount={execution.role_sections.installer.items_count}
              handoverStage={execution.role_sections.installer.handover_stage}
              handoverStageLabel={execution.role_sections.installer.handover_stage_label}
              balanceDue={execution.role_sections.installer.balance_due}
              paymentState={execution.role_sections.installer.payment_state}
              warnings={execution.role_sections.installer.warnings}
              orderId={order.id}
              onHandoverStageChanged={refetchExecution}
              photoReportStatus={normalizePhotoReportStatus(execution.role_sections.installer.photo_report_status)}
              photoReportCount={execution.role_sections.installer.photo_report_count ?? 0}
              photoReports={execution.role_sections.installer.photo_reports || []}
              completionActStatus={execution.role_sections.installer.completion_act_status}
              completionActAvailable={execution.role_sections.installer.completion_act_available}
              completionAct={execution.role_sections.installer.completion_act}
            />
          )}
        </div>

        {/* Right column - Sidebar info */}
        <div className="space-y-6">
          <OrderExecutionPanel order={order} execution={execution} />

          {/* Source Quote (if created from quote) */}
          <SourceQuoteSection sourceQuote={order.source_quote} />

          {/* Source Task (if converted from task) */}
          <SourceTaskSection sourceTask={order.source_task} />

          {/* Related Payments */}
          <PaymentsSection
            orderId={order.id}
            payments={order.payments || []}
            totalAmount={order.total_amount}
            totalPaid={order.paid_amount}
            balanceDue={order.balance_due}
            orderStatus={order.status}
          />

          <OrderNotes notes={order.notes} />
          <OrderMetadata order={order} />
        </div>
      </div>

      {/* Production Stage Modal */}
      <ProductionStageModal
        isOpen={productionStageModalOpen}
        onClose={() => setProductionStageModalOpen(false)}
        orderId={orderId}
        onSuccess={async () => {
          setProductionStageModalOpen(false);
          await refetchExecution();
        }}
      />

      {/* Cancel Modal - Using Sheet as Dialog replacement */}
      <Sheet open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Отмена заказа</SheetTitle>
            <SheetDescription>
              Укажите причину отмены. Это действие нельзя отменить.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <Textarea
              placeholder="Причина отмены..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-25"
            />
          </div>
          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              Закрыть
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? 'Отмена...' : 'Подтвердить отмену'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
