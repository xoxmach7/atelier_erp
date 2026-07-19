"use client";

import { useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuote, useUpdateQuote, useDeleteQuote, useConvertQuoteToOrder } from "@/hooks/useQuotes";
import { ApiClientError } from "@/services/http/client";
import type { QuoteItemDTO, QuoteStatus } from "@/types";
import { shortOrderNumber } from "@/lib/order-number";
import {
  Calculator,
  ArrowLeft,
  Edit2,
  Save,
  X,
  Trash2,
  User,
  Package,
  CheckCircle2,
  AlertCircle,
  Plus,
  ShoppingCart,
  Globe,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  sent: "Отправлено",
  approved: "Принято",
  rejected: "Отклонено",
  expired: "Просрочено",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return `₸ ${num.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : 0;
}

function isPositive(value: string | number | null | undefined): boolean {
  return toNumber(value) > 0;
}

function hasText(value: string | null | undefined): boolean {
  return !!value?.trim();
}

function formatMeters(value: string | number | null | undefined): string | null {
  const num = toNumber(value);
  if (num <= 0) return null;
  return `${num.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м`;
}

function formatCentimeters(value: string | number | null | undefined): string | null {
  const num = toNumber(value);
  if (num <= 0) return null;
  return `${num.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} см`;
}

function getFabricName(item: QuoteItemDTO): string {
  return item.fabric_details?.name || "Ткань выбрана";
}

function getTulleName(item: QuoteItemDTO): string {
  return item.tulle_fabric_details?.name || "Тюль выбран";
}

function hasFabric(item: QuoteItemDTO): boolean {
  return !!item.fabric_details || !!item.fabric || isPositive(item.fabric_meters) || isPositive(item.fabric_cost);
}

function hasTulle(item: QuoteItemDTO): boolean {
  return !!item.tulle_fabric_details || !!item.tulle_fabric || isPositive(item.tulle_meters) || isPositive(item.tulle_cost);
}

function hasCornice(item: QuoteItemDTO): boolean {
  return !!item.cornice_details || !!item.cornice || isPositive(item.cornice_length_m) || isPositive(item.cornice_cost);
}

function SupplyModeBadge({ mode }: { mode: QuoteItemDTO["supply_mode"] }) {
  const config = {
    in_stock: { label: "На складе", Icon: Package },
    purchase_local: { label: "Закупить локально", Icon: ShoppingCart },
    purchase_import: { label: "Закупить импорт", Icon: Globe },
    client_supplied: { label: "Клиентский", Icon: User },
  }[mode];

  if (!config) return null;
  const { label, Icon } = config;

  return (
    <Badge variant="outline" className="text-xs font-normal">
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

function DetailRow({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>
        {children}
      </span>
    </div>
  );
}

function QuoteItemCard({ item, index }: { item: QuoteItemDTO; index: number }) {
  const roomName = hasText(item.room_name) ? item.room_name : null;
  const windowName = hasText(item.window_name) ? item.window_name : null;
  const width = formatCentimeters(item.window_width_cm);
  const height = formatCentimeters(item.window_height_cm);
  const dimensions = width && height ? `${width} × ${height}` : width || height;
  const fabricMeters = formatMeters(item.fabric_meters);
  const tulleMeters = formatMeters(item.tulle_meters);
  const corniceLength = formatMeters(item.cornice_length_m);

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-medium text-slate-900">
            {index + 1}. {roomName || windowName || "Позиция КП"}
          </div>
          {(roomName || windowName) && (
            <div className="mt-1 text-sm text-slate-500">
              {[roomName && `Комната: ${roomName}`, windowName && `Окно / изделие: ${windowName}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          {item.supply_mode && <SupplyModeBadge mode={item.supply_mode} />}
          <span className="font-semibold text-slate-900">
            {formatCurrency(item.line_total)}
          </span>
        </div>
      </div>

      <div className="text-sm">
        {roomName && <DetailRow label="Комната">{roomName}</DetailRow>}
        {windowName && <DetailRow label="Окно / изделие">{windowName}</DetailRow>}
        {dimensions && <DetailRow label="Размеры">{dimensions}</DetailRow>}
        {hasFabric(item) && (
          <DetailRow label="Ткань штор">
            <span className="block">{getFabricName(item)}</span>
            <span className="block text-xs text-slate-500">
              {[fabricMeters, formatCurrency(item.fabric_cost)].filter(Boolean).join(" · ")}
            </span>
          </DetailRow>
        )}
        {hasTulle(item) && (
          <DetailRow label="Тюль">
            <span className="block">{getTulleName(item)}</span>
            <span className="block text-xs text-slate-500">
              {[tulleMeters, formatCurrency(item.tulle_cost)].filter(Boolean).join(" · ")}
            </span>
          </DetailRow>
        )}
        {isPositive(item.sewing_cost) && (
          <DetailRow label="Пошив">{formatCurrency(item.sewing_cost)}</DetailRow>
        )}
        {hasCornice(item) && (
          <DetailRow label="Карниз">
            <span className="block">{item.cornice_details?.name || "Карниз выбран"}</span>
            <span className="block text-xs text-slate-500">
              {[corniceLength, formatCurrency(item.cornice_cost)].filter(Boolean).join(" · ")}
            </span>
          </DetailRow>
        )}
        {isPositive(item.installation_price) && (
          <DetailRow label="Монтаж">{formatCurrency(item.installation_price)}</DetailRow>
        )}
        {isPositive(item.accessories_cost) && (
          <DetailRow label="Аксессуары">{formatCurrency(item.accessories_cost)}</DetailRow>
        )}
        {isPositive(item.additional_services_total) && (
          <DetailRow label="Доп. услуги">{formatCurrency(item.additional_services_total)}</DetailRow>
        )}
        <DetailRow label="Итого по позиции" strong>
          {formatCurrency(item.line_total)}
        </DetailRow>
      </div>
    </div>
  );
}

export default function QuoteDetailPage() {
  return (
    <ProtectedRoute>
      <QuoteDetailContent />
    </ProtectedRoute>
  );
}

function QuoteDetailContent() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editedStatus, setEditedStatus] = useState<string>("");

  const {
    data: quote,
    isLoading,
    isError,
    error,
  } = useQuote(quoteId);

  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();
  const convertToOrder = useConvertQuoteToOrder();

  if (isLoading) {
    return <LoadingState message="Загрузка КП..." />;
  }

  if (isError || !quote) {
    return (
      <ErrorState
        title="Ошибка загрузки КП"
        description={error?.message || "КП не найдено"}
      />
    );
  }

  const handleEdit = () => {
    setEditedStatus(quote.status);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateQuote.mutateAsync({
        id: quoteId,
        data: {
          status: editedStatus as QuoteStatus,
        },
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update quote:", err);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this quote?")) return;
    try {
      await deleteQuote.mutateAsync(quoteId);
      router.push("/quotes");
    } catch (err) {
      console.error("Failed to delete quote:", err);
    }
  };

  const handleConvertToOrder = async () => {
    if (!confirm("Создать заказ из этого КП?")) return;
    try {
      const order = await convertToOrder.mutateAsync({ quoteId });
      // Redirect to the created order detail page
      router.push(`/orders/${order.id}`);
    } catch (err) {
      // Check if it's a duplicate conversion error (409)
      const status = err instanceof ApiClientError ? err.status : undefined;
      const data = err instanceof ApiClientError ? (err.data as { error?: string; order_id?: string } | undefined) : undefined;

      if (status === 409 || data?.error?.includes('already converted')) {
        const existingOrderId = data?.order_id;
        if (existingOrderId) {
          // Redirect without alert - clean UX
          router.push(`/orders/${existingOrderId}`);
        } else {
          alert('Этот КП уже конвертирован в заказ.');
        }
      } else {
        console.error("Failed to convert quote to order:", err);
        const message = err instanceof Error ? err.message : undefined;
        alert(message || "Не удалось создать заказ. Попробуйте позже.");
      }
    }
  };

  // Check if quote already has a linked order
  const hasConvertedOrder = !!quote?.converted_order;
  // Check if quote is approved (backend requires approved status for conversion)
  const isApprovedQuote = quote?.status === "approved";
  const quoteItems = quote.items || [];
  const customerName = quote.customer_name?.trim() || "Клиент не указан";
  const totals = quoteItems.reduce(
    (acc, item) => ({
      fabric: acc.fabric + toNumber(item.fabric_cost),
      tulle: acc.tulle + toNumber(item.tulle_cost),
      sewing: acc.sewing + toNumber(item.sewing_cost),
      cornice: acc.cornice + toNumber(item.cornice_cost),
      installation: acc.installation + toNumber(item.installation_price),
      accessories: acc.accessories + toNumber(item.accessories_cost),
      additionalServices: acc.additionalServices + toNumber(item.additional_services_total),
    }),
    {
      fabric: 0,
      tulle: 0,
      sewing: 0,
      cornice: 0,
      installation: 0,
      accessories: 0,
      additionalServices: 0,
    }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.quote_number}
        description={
          <span className="flex items-center gap-2">
            Коммерческое предложение
            <Badge
              className={
                STATUS_COLORS[quote.status] || "bg-slate-100 text-slate-700"
              }
            >
              {STATUS_LABELS[quote.status] || quote.status}
            </Badge>
          </span>
        }
      >
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={updateQuote.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {updateQuote.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                Отмена
              </Button>
            </>
          ) : (
            <>
              {quote.status === "draft" && (
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Изменить статус
                </Button>
              )}
              {hasConvertedOrder ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-600"
                  asChild
                >
                  <Link href={`/orders/${quote.converted_order!.id}`}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Заказ {shortOrderNumber(quote.converted_order!.order_number)}
                  </Link>
                </Button>
              ) : !isApprovedQuote ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="КП должно быть в статусе 'Принято' для конвертации в заказ"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Требуется статус &quot;Принято&quot;
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConvertToOrder}
                  disabled={convertToOrder.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {convertToOrder.isPending ? "Создание..." : "Создать заказ"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={handleDelete}
                disabled={deleteQuote.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteQuote.isPending ? "Удаление..." : "Удалить"}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/quotes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К списку КП
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Изменить статус КП</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="text-sm font-medium mb-1 block">
                  Статус
                </label>
                <Select value={editedStatus} onValueChange={setEditedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="sent">Отправлено</SelectItem>
                    <SelectItem value="approved">Принято</SelectItem>
                    <SelectItem value="rejected">Отклонено</SelectItem>
                    <SelectItem value="expired">Просрочено</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Quote Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Позиции КП ({quoteItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quoteItems.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">
                  Нет позиций в этом КП
                </div>
              ) : (
                <div className="space-y-3">
                  {quoteItems.map((item: QuoteItemDTO, index: number) => (
                    <QuoteItemCard key={item.id} item={item} index={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Клиент
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-medium">
                  {customerName}
                </div>
                <div className="text-sm text-slate-500">
                  Действует до: {formatDate(quote.valid_until)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Итоги
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ткань штор</span>
                <span>{formatCurrency(totals.fabric)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Тюль</span>
                <span>{formatCurrency(totals.tulle)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Пошив</span>
                <span>{formatCurrency(totals.sewing)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Карнизы</span>
                <span>{formatCurrency(totals.cornice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Монтаж</span>
                <span>{formatCurrency(totals.installation)}</span>
              </div>
              {totals.accessories > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Аксессуары</span>
                  <span>{formatCurrency(totals.accessories)}</span>
                </div>
              )}
              {totals.additionalServices > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Доп. услуги</span>
                  <span>{formatCurrency(totals.additionalServices)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Подытог КП</span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.discount_amount && quote.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Скидка</span>
                  <span className="text-green-600">
                    -{formatCurrency(quote.discount_amount)}
                  </span>
                </div>
              )}
              {quote.installation_cost && quote.installation_cost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Монтаж</span>
                  <span>{formatCurrency(quote.installation_cost)}</span>
                </div>
              )}
              {quote.delivery_cost && quote.delivery_cost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Доставка</span>
                  <span>{formatCurrency(quote.delivery_cost)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Итого</span>
                <span>{formatCurrency(quote.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Conversion Status */}
          {hasConvertedOrder && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium mb-1">КП конвертирован в заказ</p>
                    <p className="text-xs">
                      Этот КП был преобразован в заказ{" "}
                      <Link
                        href={`/orders/${quote.converted_order!.id}`}
                        className="font-semibold underline hover:text-green-900"
                      >
                        {shortOrderNumber(quote.converted_order!.order_number)}
                      </Link>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
