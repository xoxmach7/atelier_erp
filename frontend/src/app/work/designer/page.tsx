"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useMeasurements } from "@/hooks/useMeasurements";
import { useOrders } from "@/hooks/useOrders";
import {
  EmptyRoleState,
  OpenOrderButton,
  OrderTaskCard,
  TaskSection,
  WorkspaceHeader,
  isOverdue,
} from "@/components/layout/role-workspace";

function DesignerWorkspace() {
  const ordersQuery = useOrders({ pageSize: 100 });
  const measurementsQuery = useMeasurements({ pageSize: 100 });

  if (ordersQuery.isLoading || measurementsQuery.isLoading) return <LoadingState message="Загрузка рабочего места дизайнера..." />;
  if (ordersQuery.isError) return <ErrorState title="Не удалось загрузить заказы" description={ordersQuery.error?.message || "Проверьте API заказов."} />;

  const orders = ordersQuery.data?.results || [];
  const measurements = measurementsQuery.data?.results || [];
  const measuredOrderIds = new Set(measurements.map((measurement) => measurement.order));
  const needsMeasurement = orders.filter((order) => ["new", "in_work"].includes(order.status) && !measuredOrderIds.has(order.id));
  const needsQuote = orders.filter((order) => ["new", "in_work"].includes(order.status) && measuredOrderIds.has(order.id));
  const overdue = orders.filter(isOverdue);

  return (
    <>
      <WorkspaceHeader
        title="Дизайнер / Замеры"
        description="Дизайнер фиксирует размеры, ткань, тюль и метраж. Цены считаются позже в КП."
      >
        <Button asChild><Link href="/measurements">Все замеры</Link></Button>
        <Button asChild variant="outline"><Link href="/orders">Все заказы</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <TaskSection title="Нужен замер" count={needsMeasurement.length}>
          <div className="grid gap-3">
            {needsMeasurement.slice(0, 8).map((order) => (
              <OrderTaskCard key={order.id} order={order} nextStep="Добавить замер: комната, окно, размеры, ткань, тюль, метраж.">
                <Button asChild size="sm"><Link href={`/measurements?order=${order.id}`}>Добавить замер</Link></Button>
                <OpenOrderButton orderId={order.id} view="designer" />
              </OrderTaskCard>
            ))}
            {needsMeasurement.length === 0 ? <EmptyRoleState text="Нет заказов без замера." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Замер есть, нужно КП" count={needsQuote.length}>
          <div className="grid gap-3">
            {needsQuote.slice(0, 8).map((order) => (
              <OrderTaskCard key={order.id} order={order} nextStep="Параметры клиента есть. Следующий шаг — собрать КП и внести цены.">
                <Button asChild size="sm"><Link href={`/estimate?customer=${order.customer}&order=${order.id}`}>Создать КП</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href={`/measurements?order=${order.id}`}>Открыть замеры</Link></Button>
                <OpenOrderButton orderId={order.id} view="designer" />
              </OrderTaskCard>
            ))}
            {needsQuote.length === 0 ? <EmptyRoleState text="Нет заказов с замером без следующего шага КП." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Просрочено / требует внимания" count={overdue.length}>
          <div className="grid gap-3">
            {overdue.slice(0, 8).map((order) => (
              <OrderTaskCard key={order.id} order={order} nextStep="Проверьте дату и следующий шаг по заказу.">
                <OpenOrderButton orderId={order.id} view="designer" />
              </OrderTaskCard>
            ))}
            {overdue.length === 0 ? <EmptyRoleState text="Просроченных задач дизайнера не найдено." /> : null}
          </div>
        </TaskSection>
      </div>
    </>
  );
}

export default function DesignerWorkPage() {
  return (
    <ProtectedRoute>
      <DesignerWorkspace />
    </ProtectedRoute>
  );
}
