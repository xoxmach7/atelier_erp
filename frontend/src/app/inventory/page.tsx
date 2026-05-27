"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFabrics } from "@/hooks/useFabrics";
import type { FabricDTO } from "@/types";
import { AlertTriangle, Calculator, Check, Package, Search } from "lucide-react";

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

function fabricTitle(fabric: FabricDTO): string {
  return fabric.name?.trim() || fabric.hanger_number?.trim() || "Ткань без названия";
}

function stockState(fabric: FabricDTO): { label: string; tone: "red" | "yellow" | "green" } {
  const available = toNumber(fabric.available_meters);
  const stock = toNumber(fabric.stock_meters);
  const ratio = stock > 0 ? available / stock : 0;

  if (available <= 0) return { label: "Нужно закупить", tone: "red" };
  if (available < 10 || ratio < 0.3) return { label: "Проверить", tone: "yellow" };
  return { label: "Готово", tone: "green" };
}

function stateDot(tone: "red" | "yellow" | "green") {
  if (tone === "red") return "bg-red-500";
  if (tone === "yellow") return "bg-yellow-300";
  return "bg-green-500";
}

function StockIcon({ tone }: { tone: "red" | "yellow" | "green" }) {
  if (tone === "green") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500 text-white">
        <Check className="h-4 w-4" />
      </span>
    );
  }
  return <AlertTriangle className={tone === "red" ? "h-6 w-6 text-red-500" : "h-6 w-6 text-amber-500"} />;
}

function FabricRow({ fabric }: { fabric: FabricDTO }) {
  const state = stockState(fabric);

  return (
    <div className="border-t border-white bg-neutral-100 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 shrink-0 rounded-full border border-neutral-300"
              style={{ backgroundColor: safeColor(fabric.color) }}
            />
            <div className="truncate text-sm font-semibold text-neutral-900">{fabricTitle(fabric)}</div>
          </div>
          <div className="mt-1 text-sm text-neutral-700">
            Остаток: {formatMeters(fabric.stock_meters)} · Резерв: {formatMeters(fabric.reserved_meters)}
          </div>
          <div className="mt-0.5 text-sm text-neutral-700">
            Доступно: {formatMeters(fabric.available_meters)} · {formatCurrency(fabric.price_per_meter)} / м
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={state.tone === "green" ? "bg-green-100 text-green-700" : state.tone === "yellow" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}>
              {state.label}
            </Badge>
            {fabric.hanger_number ? <span className="text-xs text-neutral-500">Вешалка {fabric.hanger_number}</span> : null}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className={`h-5 w-5 rounded-full ${stateDot(state.tone)}`} />
          <StockIcon tone={state.tone} />
        </div>
      </div>
    </div>
  );
}

function InventoryContent() {
  const { data, isLoading, isError, error } = useFabrics();
  const fabrics: FabricDTO[] = data?.results || [];

  if (isLoading) {
    return <LoadingState message="Загрузка склада..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Ошибка загрузки склада"
        description={error?.message || "Проверьте API склада и попробуйте позже."}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-neutral-100 px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="overflow-hidden rounded-[2px] border-0 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="px-5 pb-5 pt-10">
              <div className="mb-6 text-sm text-neutral-500">Выйти</div>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-medium text-neutral-950">Склад</h1>
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-400 text-white">
                    <Search className="h-4 w-4" />
                  </span>
                  <Package className="h-7 w-7 text-sky-400" />
                </div>
              </div>
              <div className="mt-3 text-sm text-neutral-500">{data?.count || 0} тканей в справочнике</div>
            </div>

            <div className="bg-neutral-100">
              {fabrics.length > 0 ? (
                fabrics.map((fabric) => <FabricRow key={fabric.id} fabric={fabric} />)
              ) : (
                <div className="px-5 py-10">
                  <EmptyState
                    title="На складе пока нет тканей"
                    description="Когда ткани появятся в API, они будут отображены с остатком, резервом и доступностью."
                    icon={<Package className="h-6 w-6 text-slate-600" />}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="font-medium text-neutral-950">Готовность материалов</div>
              <div className="mt-2 text-sm text-neutral-500">
                Склад показывает фактические ткани. Обновление `material_readiness` выполняется в карточке заказа,
                потому что backend queue по потребностям материалов пока не выделен.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/orders">Заказы</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/estimate">
                    <Calculator className="mr-2 h-4 w-4" />
                    КП
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <ProtectedRoute>
      <InventoryContent />
    </ProtectedRoute>
  );
}
