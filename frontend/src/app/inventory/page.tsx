"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader, EmptyState, LoadingState, ErrorState, WorkflowInfoCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFabrics } from "@/hooks/useFabrics";
import type { FabricDTO } from "@/types";
import { Calculator, Package, Plus } from "lucide-react";

function toNumber(value: string | number | null | undefined): number {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(num) ? Number(num) : 0;
}

function formatCurrency(value: string | number | null | undefined): string {
  const num = toNumber(value);
  return `₸ ${num.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}`;
}

function formatMeters(value: string | number | null | undefined): string {
  return `${toNumber(value).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м`;
}

function safeColor(value: string | null | undefined): string {
  if (!value) return "#CBD5E1";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
  const palette: Record<string, string> = {
    белый: "#F8FAFC",
    серый: "#94A3B8",
    синий: "#3B82F6",
    зеленый: "#22C55E",
    зелёный: "#22C55E",
    красный: "#EF4444",
    бежевый: "#D6B88D",
    черный: "#111827",
    чёрный: "#111827",
  };
  return palette[value.toLowerCase()] || "#CBD5E1";
}

function StockBadge({ fabric }: { fabric: FabricDTO }) {
  const available = toNumber(fabric.available_meters);
  const stock = toNumber(fabric.stock_meters);
  const ratio = stock > 0 ? available / stock : 0;

  if (available <= 0) {
    return <Badge className="bg-red-100 text-red-700">Нет в наличии</Badge>;
  }

  if (available < 10 || ratio < 0.3) {
    return <Badge className="bg-amber-100 text-amber-700">Низкий запас</Badge>;
  }

  return <Badge className="bg-green-100 text-green-700">В наличии</Badge>;
}

function fabricTitle(fabric: FabricDTO): string {
  return fabric.name?.trim() || fabric.hanger_number?.trim() || "Ткань без названия";
}

function InventoryContent() {
  const { data, isLoading, isError, error } = useFabrics();
  const fabrics: FabricDTO[] = data?.results || [];

  if (isLoading) {
    return (
      <>
        <PageHeader title="Склад" description="Ткани, остатки и доступность материалов" />
        <LoadingState message="Загрузка склада..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Склад" description="Ткани, остатки и доступность материалов" />
        <ErrorState
          title="Ошибка загрузки склада"
          description={error?.message || "Проверьте API склада и попробуйте позже."}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Склад"
        description={`${data?.count || 0} тканей в справочнике`}
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

      <div className="mb-6">
        <WorkflowInfoCard
          title="Готовность материалов"
          description="Склад влияет на material_readiness заказа: материалы должны быть обеспечены перед запуском пошива. Сложная агрегация по заказам требует отдельного backend endpoint."
          icon={<Package className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />}
        />
      </div>

      {fabrics.length === 0 ? (
        <EmptyState
          title="На складе пока нет тканей"
          description="Когда ткани появятся в API, они будут отображены с остатками, резервом и ценой за метр."
          icon={<Package className="h-6 w-6 text-slate-600" />}
        />
      ) : (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Ткань</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Цвет</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Запас</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Резерв</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Доступно</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Цена / м</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-700">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fabrics.map((fabric) => (
                    <tr key={fabric.id} className={!fabric.is_active ? "opacity-50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{fabricTitle(fabric)}</div>
                        <div className="text-xs text-slate-500">
                          {fabric.hanger_number ? `Вешалка ${fabric.hanger_number}` : "Вешалка не указана"}
                          {fabric.composition ? ` · ${fabric.composition}` : ""}
                          {fabric.width_cm ? ` · ${fabric.width_cm} см` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full border border-slate-200"
                            style={{ backgroundColor: safeColor(fabric.color) }}
                          />
                          <span>{fabric.color || "Цвет не указан"}</span>
                          {fabric.pattern && <span className="text-xs text-slate-500">({fabric.pattern})</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{formatMeters(fabric.stock_meters)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{formatMeters(fabric.reserved_meters)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMeters(fabric.available_meters)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(fabric.price_per_meter)}</td>
                      <td className="px-4 py-3 text-center">
                        <StockBadge fabric={fabric} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
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
