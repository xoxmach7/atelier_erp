"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuote, useUpdateQuote, useDeleteQuote } from "@/hooks/useQuotes";
import { useCustomers } from "@/hooks/useCustomers";
import type { QuoteDTO, QuoteItemDTO, QuoteStatus } from "@/types";
import {
  Calculator,
  ArrowLeft,
  Edit2,
  Save,
  X,
  Trash2,
  User,
  FileText,
  Package,
  Calendar,
  CheckCircle,
  AlertCircle,
  Plus,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  sent: "Отправлено",
  accepted: "Принято",
  rejected: "Отклонено",
  expired: "Просрочено",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return `₸ ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

  const { data: customersData } = useCustomers();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();

  const customers = customersData?.results || [];

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.quote_number}
        description={
          <span className="flex items-center gap-2">
            Persisted Quote
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
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit2 className="mr-2 h-4 w-4" />
                Редактировать
              </Button>
              <Button
                variant="default"
                size="sm"
                asChild
              >
                <Link href={`/orders/new?customer=${quote.customer}&source=quote&ref=${encodeURIComponent(quote.quote_number)}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Создать заказ
                </Link>
              </Button>
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
              ← К КП
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quote Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Информация о КП
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Статус
                    </label>
                    <Select
                      value={editedStatus}
                      onValueChange={setEditedStatus}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Черновик</SelectItem>
                        <SelectItem value="sent">Отправлено</SelectItem>
                        <SelectItem value="accepted">Принято</SelectItem>
                        <SelectItem value="rejected">Отклонено</SelectItem>
                        <SelectItem value="expired">Просрочено</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-500">Номер КП</span>
                    <span className="font-medium">{quote.quote_number}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-500">Статус</span>
                    <Badge
                      className={
                        STATUS_COLORS[quote.status] ||
                        "bg-slate-100 text-slate-700"
                      }
                    >
                      {STATUS_LABELS[quote.status] || quote.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-500">Действует до</span>
                    <span>{formatDate(quote.valid_until)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quote Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Позиции КП ({quote.items?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quote.items?.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">
                  Нет позиций в этом КП
                </div>
              ) : (
                <div className="space-y-3">
                  {quote.items?.map((item: QuoteItemDTO, index: number) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {index + 1}. {item.room_name}
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(item.line_total)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 grid grid-cols-2 gap-2">
                        <span>Width: {item.window_width_cm} cm</span>
                        <span>Height: {item.window_height_cm} cm</span>
                        {item.fabric_details && (
                          <span>
                            Fabric: {item.fabric_details.name}
                          </span>
                        )}
                        {item.cornice_details && (
                          <span>
                            Cornice: {item.cornice_details.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-3 border-t text-sm text-slate-500">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Редактирование позиций ограничено в этой версии. Для изменения создайте новую смету.
              </div>
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
                  {quote.customer_name || quote.customer}
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
                <span className="text-slate-500">Подытог</span>
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

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Метаданные
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Создано</span>
                <span>{formatDate(quote.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Обновлено</span>
                <span>{formatDate(quote.updated_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Кем</span>
                <span>{quote.created_by}</span>
              </div>
            </CardContent>
          </Card>

          {/* Honest Limitation */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium mb-1">Ограничения КП</p>
                  <ul className="space-y-1 text-xs">
                    <li>• КП не связаны напрямую с заказами</li>
                    <li>• Редактирование позиций требует создания новой сметы</li>
                    <li>• Статусы меняются только вручную</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
