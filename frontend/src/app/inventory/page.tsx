"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ErrorState,
  WorkflowInfoCard,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFabrics } from "@/hooks/useFabrics";
import type { FabricDTO } from "@/types";
import { Plus, Package, Calculator } from "lucide-react";
import Link from "next/link";

function formatCurrency(value: string | null): string {
  if (!value) return "₸ 0";
  return `₸ ${parseFloat(value).toLocaleString()}`;
}

function formatMeters(value: string | null): string {
  if (!value) return "0 м";
  return `${parseFloat(value).toFixed(1)} м`;
}

function StockIndicator({ fabric }: { fabric: FabricDTO }) {
  const available = parseFloat(fabric.available_meters);
  const stock = parseFloat(fabric.stock_meters);

  if (available <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Нет в наличии
      </span>
    );
  }

  if (available < 10) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        Мало на складе
      </span>
    );
  }

  if (available / stock < 0.3) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        Мало на складе
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
      В наличии
    </span>
  );
}

function InventoryContent() {
  const { data, isLoading, isError, error } = useFabrics();
  const fabrics: FabricDTO[] = data?.results || [];

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Склад"
          description="Учет тканей, материалов и уровня запасов"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Добавить ткань
          </Button>
        </PageHeader>
        <LoadingState message="Загрузка склада..." />
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <PageHeader
          title="Склад"
          description="Учет тканей, материалов и уровня запасов"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Добавить ткань
          </Button>
        </PageHeader>

        <ErrorState
          title="Ошибка загрузки склада"
          description={error?.message || "Что-то пошло не так. Попробуйте позже."}
          context={`Убедитесь, что бэкенд запущен: ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}`}
        />
      </>
    );
  }

  // Empty state
  if (fabrics.length === 0) {
    return (
      <>
        <PageHeader
          title="Склад"
          description="Учет тканей, материалов и уровня запасов"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Добавить ткань
          </Button>
        </PageHeader>

        <EmptyState
          title="На складе нет тканей"
          description="Добавьте ткани для начала учета запасов"
          icon={<Package className="h-6 w-6 text-slate-600" />}
          action={{
            label: "Добавить первую ткань",
            onClick: () => {},
          }}
        />
      </>
    );
  }

  // Data table with fabrics
  return (
    <>
      <PageHeader
        title="Склад"
        description={`${data?.count || 0} тканей в наличии`}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/estimate">
              <Calculator className="mr-2 h-4 w-4" />
              К смете
            </Link>
          </Button>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Добавить ткань
          </Button>
        </div>
      </PageHeader>

      {/* Contextual info card - links Inventory to Estimate workflow */}
      <div className="mb-6">
        <WorkflowInfoCard
          title="Склад → Смета"
          description={
            <>
              Ткани из этого списка доступны в{" "}
              <Link href="/estimate" className="underline hover:text-blue-800">
                конструкторе смет
              </Link>
              . Товары с низким запасом выделены.
            </>
          }
          icon={<Calculator className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Вешалка №</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Ткань</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Цвет</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Запас</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Резерв</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Доступно</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Цена/м</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-700">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fabrics.map((fabric) => (
                  <tr
                    key={fabric.id}
                    className={`hover:bg-slate-50 ${!fabric.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {fabric.hanger_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{fabric.name}</div>
                      <div className="text-xs text-slate-500">{fabric.composition} • {fabric.width_cm}cm</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full border border-slate-200"
                          style={{ backgroundColor: fabric.color.toLowerCase() }}
                          title={fabric.color}
                        />
                        <span>{fabric.color}</span>
                        {fabric.pattern && (
                          <span className="text-xs text-slate-500">({fabric.pattern})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMeters(fabric.stock_meters)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {formatMeters(fabric.reserved_meters)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      <span className={parseFloat(fabric.available_meters) <= 0 ? "text-red-600" : ""}>
                        {formatMeters(fabric.available_meters)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(fabric.price_per_meter)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockIndicator fabric={fabric} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.count > 0 && (
            <div className="border-t px-4 py-3 text-sm text-slate-500">
              Показано {fabrics.length} из {data.count} тканей
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function InventoryPage() {
  return (
    <ProtectedRoute>
      <InventoryContent />
    </ProtectedRoute>
  );
}
