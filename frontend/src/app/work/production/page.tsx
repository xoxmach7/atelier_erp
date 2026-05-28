"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useOrders } from "@/hooks/useOrders";
import {
  EmptyRoleState,
  OpenOrderButton,
  OrderTaskCard,
  TaskSection,
  WorkspaceHeader,
} from "@/components/layout/role-workspace";

function ProductionWorkspace() {
  const ordersQuery = useOrders({ pageSize: 100 });

  if (ordersQuery.isLoading) return <LoadingState message="Загрузка рабочего места пошива..." />;
  if (ordersQuery.isError) return <ErrorState title="Не удалось загрузить заказы" description={ordersQuery.error?.message || "Проверьте API заказов."} />;

  const orders = ordersQuery.data?.results || [];
  const sewingOrders = orders.filter((order) => order.status === "in_production");
  const readyForProduction = orders.filter((order) => order.status === "in_work");

  return (
    <ProtectedRoute>
      <WorkspaceHeader
        title="Пошив / Производство"
        description="Швея видит только рабочие данные: что изготовить, размеры, ткань, тюль, срок и комментарии дизайнера. Финансы здесь не показываются."
      >
        <Button asChild><Link href="/production">Очередь производства</Link></Button>
        <Button asChild variant="outline"><Link href="/orders">Все заказы</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="В пошиве" count={sewingOrders.length} description="Откройте заказ, чтобы увидеть изделия, комнату/окно, ткани и stage производства.">
          <div className="grid gap-3">
            {sewingOrders.slice(0, 10).map((order) => (
              <OrderTaskCard key={order.id} order={order} nextStep="Проверьте изделия и отметьте production_stage в заказе: not_started → sewing → done.">
                <OpenOrderButton orderId={order.id} />
              </OrderTaskCard>
            ))}
            {sewingOrders.length === 0 ? <EmptyRoleState text="Нет заказов в пошиве." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Готовятся к запуску" count={readyForProduction.length} description="Заказы в работе: после договорённости и готовности материалов их можно передать в производство через order detail.">
          <div className="grid gap-3">
            {readyForProduction.slice(0, 8).map((order) => (
              <OrderTaskCard key={order.id} order={order} nextStep="Проверьте КП, материалы и договорённость перед запуском в работу.">
                <OpenOrderButton orderId={order.id} />
              </OrderTaskCard>
            ))}
            {readyForProduction.length === 0 ? <EmptyRoleState text="Нет заказов на подготовке к производству." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function ProductionWorkPage() {
  return <ProductionWorkspace />;
}
