"use client";

import { useRouter } from "next/navigation";
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
import { useOrder } from "@/hooks/useOrders";
import type { OrderDetailDTO, OrderItemDTO, MeasurementDTO, PaymentDTO, TaskStatus } from "@/types";
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
  Clock,
  FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

function formatCurrency(value: string | null): string {
  if (!value) return "₸ 0";
  return `₸ ${parseFloat(value).toLocaleString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function OrderItemRow({ item }: { item: OrderItemDTO }) {
  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0">
      <div className="flex-1">
        <div className="font-medium">{item.description}</div>
        <div className="text-sm text-slate-500 mt-1">
          {item.item_type}
          {item.fabric && ` • ${item.fabric}`}
          {item.fabric_meters && ` • ${item.fabric_meters}м`}
          {item.cornice && ` • ${item.cornice}`}
          {item.service && ` • ${item.service}`}
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

function OrderItems({ items }: { items: OrderItemDTO[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Позиции заказа ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-slate-500 italic">Нет позиций</div>
        ) : (
          <div>
            {items.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </div>
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
      href: `/estimate?customer=${customerId}`,
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
 * Measurements Section - Shows related measurements for this order
 */
function MeasurementsSection({ orderId, measurements }: { orderId: string; measurements: MeasurementDTO[] }) {
  // Check if orderId is valid (not a placeholder)
  const isValidOrderId = orderId && orderId !== "[id]" && orderId !== "%5Bid%5D" && !orderId.includes("[");
  const measurementsHref = isValidOrderId ? `/measurements?order=${orderId}` : "/measurements";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Замеры
            {measurements.length > 0 && (
              <span className="text-sm font-normal text-slate-500">({measurements.length})</span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={measurementsHref}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {measurements.length === 0 ? (
          <div className="text-sm text-slate-500">
            Замеры не записаны.
            <Link href={measurementsHref} className="ml-2 text-blue-600 hover:underline">
              Создать замер
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {measurements.slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium">{m.room_name}</div>
                  <div className="text-xs text-slate-500">
                    {m.width_cm}×{m.height_cm} cm • {m.mounting_type || "Без крепления"}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {formatDate(m.measured_at)}
                </div>
              </div>
            ))}
            {measurements.length > 3 && (
              <Link 
                href={measurementsHref}
                className="text-sm text-blue-600 hover:underline block pt-2"
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
function PaymentsSection({ orderId, payments, totalPaid, balanceDue, orderStatus }: { 
  orderId: string; 
  payments: PaymentDTO[];
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
        {/* Payment Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Общая сумма</div>
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
  ];
  
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
    console.log("[NAVIGATE] To:", url);
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
          </span>
          Этот заказ создан без КП. Это валидный рабочий процесс — можно добавлять позиции, замеры и принимать оплату напрямую.
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

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  // Guard: detect when literal [id] or placeholder is in URL
  const isPlaceholderId = !orderId || orderId === "[id]" || orderId === "%5Bid%5D" || (orderId.startsWith("[") && orderId.endsWith("]"));
  if (isPlaceholderId) {
    return (
      <>
        <PageHeader title="Ошибка навигации" description="Некорректный ID заказа">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ← К заказам
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

  const { data: order, isLoading, isError, error } = useOrder(orderId || null);

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader
          title={`Заказ ${orderId}`}
          description="Загрузка деталей заказа..."
        >
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
  if (isError) {
    return (
      <>
        <PageHeader
          title={`Заказ ${orderId}`}
          description="Ошибка загрузки заказа"
        >
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ← К заказам
            </Link>
          </Button>
        </PageHeader>

        <ErrorState
          title="Не удалось загрузить заказ"
          description={error?.message || "Что-то пошло не так. Попробуйте позже."}
        />
      </>
    );
  }

  // Not found state
  if (!order) {
    return (
      <>
        <PageHeader
          title="Заказ не найден"
          description="Запрашиваемый заказ не найден"
        >
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ← К заказам
            </Link>
          </Button>
        </PageHeader>

        <EmptyState
          title="Заказ не найден"
          description={`Заказ с ID "${orderId}" не существует или был удален.`}
          icon={<Package className="h-6 w-6 text-slate-600" />}
          action={{
            label: "К заказам",
            onClick: () => window.location.href = "/orders",
          }}
        />
      </>
    );
  }

  // Data state
  return (
    <>
      <PageHeader
        title={order.order_number}
        description={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            <span className="text-slate-500">• Создан {formatDate(order.created_at)}</span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ← К заказам
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Центр действий — контекстная навигация */}
          <OrderQuickActions 
            orderId={order.id} 
            customerId={typeof order.customer === 'object' ? order.customer.id : order.customer}
            orderStatus={order.status}
          />
          
          {/* Связанные замеры */}
          <MeasurementsSection 
            orderId={order.id} 
            measurements={order.measurements || []} 
          />
          
          {/* Позиции заказа */}
          <OrderItems items={order.items} />
          <OrderNotes notes={order.notes} />
          <OrderMetadata order={order} />
        </div>

        {/* Right column - Sidebar info */}
        <div className="space-y-6">
          {/* Source Quote (if created from quote) */}
          <SourceQuoteSection sourceQuote={order.source_quote} />

          {/* Source Task (if converted from task) */}
          <SourceTaskSection sourceTask={order.source_task} />

          {/* Related Payments */}
          <PaymentsSection
            orderId={order.id}
            payments={order.payments || []}
            totalPaid={order.paid_amount}
            balanceDue={order.balance_due}
            orderStatus={order.status}
          />

          <CustomerInfo order={order} />
          <FinancialSummary order={order} />
          <OrderDates order={order} />
          <InstallationAddress order={order} />

          {/* Related Quotes - shows source quote link */}
          <RelatedQuotesSection order={order} />
        </div>
      </div>
    </>
  );
}
