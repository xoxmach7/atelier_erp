"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFabrics } from "@/hooks/useFabrics";
import { useOrders } from "@/hooks/useOrders";
import {
  EmptyRoleState,
  OpenOrderButton,
  OrderTaskCard,
  TaskSection,
  WorkspaceHeader,
  formatMoney,
  parseMoney,
} from "@/components/layout/role-workspace";

function stockState(available: string | number | null | undefined) {
  const value = parseMoney(available);
  if (value <= 0) return { label: "Нужно закупить", className: "bg-rose-100 text-rose-700" };
  if (value < 10) return { label: "Проверить", className: "bg-amber-100 text-amber-700" };
  return { label: "Готово", className: "bg-emerald-100 text-emerald-700" };
}

function WarehouseWorkspace() {
  const ordersQuery = useOrders({ pageSize: 100 });
  const fabricsQuery = useFabrics({ pageSize: 100, isActive: true });

  if (ordersQuery.isLoading || fabricsQuery.isLoading) return <LoadingState message="Загрузка рабочего места склада..." />;
  if (ordersQuery.isError) return <ErrorState title="Не удалось загрузить заказы" description={ordersQuery.error?.message || "Проверьте API заказов."} />;

  const orders = ordersQuery.data?.results || [];
  const fabrics = fabricsQuery.data?.results || [];
  const materialCheck = orders.filter((order) => ["in_work", "in_production"].includes(order.status));
  const productionOrders = orders.filter((order) => order.status === "in_production");
  const lowStock = fabrics.filter((fabric) => parseMoney(fabric.available_meters) < 10);

  return (
    <ProtectedRoute>
      <WorkspaceHeader
        title="Склад / Материалы"
        description="Склад проверяет наличие материалов и отмечает готовность материалов в заказе. Резервы и точные потребности по заказам — следующий backend-этап."
      >
        <Button asChild><Link href="/inventory">Открыть склад</Link></Button>
        <Button asChild variant="outline"><Link href="/orders">Все заказы</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <TaskSection title="Проверить материалы по заказам" count={materialCheck.length} description="Детали по fabric/tulle и готовность материалов открываются в заказе.">
            <div className="grid gap-3">
              {materialCheck.slice(0, 8).map((order) => (
                <OrderTaskCard key={order.id} order={order} nextStep="Проверьте ткани, тюль и готовность материалов в order detail.">
                  <OpenOrderButton orderId={order.id} view="warehouse" />
                </OrderTaskCard>
              ))}
              {materialCheck.length === 0 ? <EmptyRoleState text="Нет заказов, где склад должен проверить материалы." /> : null}
            </div>
          </TaskSection>

          <TaskSection title="В производстве" count={productionOrders.length} description="Заказы уже запущены, склад держит контроль по материалам и доборам.">
            <div className="grid gap-3">
              {productionOrders.slice(0, 4).map((order) => (
                <OrderTaskCard key={order.id} order={order} nextStep="Если материал не закрыт, откройте заказ и обновите готовность материалов.">
                  <OpenOrderButton orderId={order.id} view="warehouse" />
                </OrderTaskCard>
              ))}
              {productionOrders.length === 0 ? <EmptyRoleState text="Нет заказов в производстве для контроля склада." /> : null}
            </div>
          </TaskSection>
        </div>

        <TaskSection title="Ткани и остатки" count={fabrics.length} description="Живой список склада без выдуманной очереди закупок.">
          <div className="grid gap-3">
            {fabrics.slice(0, 10).map((fabric) => {
              const state = stockState(fabric.available_meters);
              return (
                <Card key={fabric.id} className="border-slate-200 bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{fabric.name || "Материал без названия"}</div>
                        <div className="mt-1 text-sm text-slate-500">Артикул: {fabric.hanger_number || "не указан"}</div>
                      </div>
                      <Badge className={state.className}>{state.label}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-slate-500">Остаток</div>
                        <div className="font-semibold">{parseMoney(fabric.stock_meters).toLocaleString("ru-RU")} м</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-slate-500">Резерв</div>
                        <div className="font-semibold">{parseMoney(fabric.reserved_meters).toLocaleString("ru-RU")} м</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <div className="text-slate-500">Доступно</div>
                        <div className="font-semibold">{parseMoney(fabric.available_meters).toLocaleString("ru-RU")} м</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-500">Цена: {formatMoney(fabric.price_per_meter)} / м</div>
                  </CardContent>
                </Card>
              );
            })}
            {fabrics.length === 0 ? <EmptyRoleState text="Материалы не найдены. Проверьте /inventory или demo seed." /> : null}
            {lowStock.length > 0 ? <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Низкий остаток: {lowStock.length}. Проверьте закупку и наличие у поставщика.</div> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function WarehouseWorkPage() {
  return <WarehouseWorkspace />;
}
