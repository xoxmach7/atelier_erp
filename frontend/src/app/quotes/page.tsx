"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuotes, useDeleteQuote } from "@/hooks/useQuotes";
import { useCustomers } from "@/hooks/useCustomers";
import type { QuoteDTO } from "@/types";
import {
  Calculator,
  Plus,
  Search,
  Eye,
  Trash2,
  ArrowLeft,
  FileText,
  User,
  Calendar,
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

export default function QuotesPage() {
  return (
    <ProtectedRoute>
      <QuotesContent />
    </ProtectedRoute>
  );
}

function QuotesContent() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [customerFilter, setCustomerFilter] = useState<string>("__all__");

  const { data: quotesData, isLoading, isError, error } = useQuotes({
    status: statusFilter !== "__all__" ? statusFilter : undefined,
    customer: customerFilter !== "__all__" ? customerFilter : undefined,
    search: searchQuery || undefined,
    pageSize: 50,
  });

  const { data: customersData } = useCustomers();
  const deleteQuote = useDeleteQuote();

  const quotes = quotesData?.results || [];
  const customers = customersData?.results || [];

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить это КП?")) return;
    try {
      await deleteQuote.mutateAsync(id);
    } catch (err) {
      console.error("Failed to delete quote:", err);
    }
  };

  if (isLoading) {
    return <LoadingState message="Загрузка КП..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Ошибка загрузки КП"
        description={error?.message || "Что-то пошло не так. Попробуйте позже."}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Коммерческие предложения"
        description={`Коммерческие предложения ${quotesData?.count || 0} сохраненных смет`}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/estimate">
              <Calculator className="mr-2 h-4 w-4" />
              Новая смета
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Заказы
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Поиск КП..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все статусы</SelectItem>
                <SelectItem value="draft">Черновик</SelectItem>
                <SelectItem value="sent">Отправлено</SelectItem>
                <SelectItem value="approved">Принято</SelectItem>
                <SelectItem value="rejected">Отклонено</SelectItem>
                <SelectItem value="expired">Просрочено</SelectItem>
              </SelectContent>
            </Select>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Все клиенты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все клиенты</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(statusFilter !== "__all__" || customerFilter !== "__all__" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("__all__");
                  setCustomerFilter("__all__");
                  setSearchQuery("");
                }}
              >
                Сбросить фильтры
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quotes List */}
      {quotes.length === 0 ? (
        <EmptyState
          title="КП не найдены"
          description="Создайте новую смету для генерации КП."
          icon={<Calculator className="h-12 w-12" />}
        />
      ) : (
        <div className="grid gap-4">
          {quotes.map((quote: QuoteDTO) => (
            <QuoteListItem
              key={quote.id}
              quote={quote}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteListItem({
  quote,
  onDelete,
}: {
  quote: QuoteDTO;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="hover:border-slate-300 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{quote.quote_number}</h3>
              <Badge
                className={
                  STATUS_COLORS[quote.status] || "bg-slate-100 text-slate-700"
                }
              >
                {STATUS_LABELS[quote.status] || quote.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-slate-500 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Клиент
                </div>
                <div className="font-medium truncate">
                  {quote.customer_name || "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Позиций
                </div>
                <div className="font-medium">{quote.items?.length || 0}</div>
              </div>
              <div>
                <div className="text-slate-500">Итого</div>
                <div className="font-medium">{formatCurrency(quote.total)}</div>
              </div>
              <div>
                <div className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Обновлено
                </div>
                <div className="font-medium">{formatDate(quote.updated_at)}</div>
              </div>
            </div>

          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/quotes/${quote.id}`}>
                <Eye className="h-4 w-4 mr-1" />
                Открыть
              </Link>
            </Button>
            {quote.status === "draft" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => onDelete(quote.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
