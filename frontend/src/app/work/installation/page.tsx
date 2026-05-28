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

function InstallationWorkspace() {
  const ordersQuery = useOrders({ pageSize: 100 });

  if (ordersQuery.isLoading) return <LoadingState message="Загрузка рабочего места установки..." />;
  if (ordersQuery.isError) return <ErrorState title="Не удалось загрузить заказы" description={ordersQuery.error?.message || "Проверьте API заказов."} />;

  const orders = ordersQuery.data?.results || [];
  const installationOrders = orders.filter((order) => ["ready", "on_installation"].includes(order.status));
  const closingOrders = orders.filter((order) => order.status === "waiting_final_payment");

  return (
    <ProtectedRoute>
      <WorkspaceHeader
        title="Установка / Выдача"
        description="Установщик видит заказ, клиента, телефон, адрес, изделия, фотоотчёт и АВР. Финансы здесь не показываются."
      >
        <Button asChild><Link href="/installation">Очередь установки</Link></Button>
        <Button asChild variant="outline"><Link href="/orders">Все заказы</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="На установку / выдачу" count={installationOrders.length} description="Откройте заказ, чтобы начать установку, завершить выдачу и добавить фотоотчёт.">
          <div className="grid gap-3">
            {installationOrders.slice(0, 10).map((order) => (
              <OrderTaskCard key={order.id} order={order} nextStep={`Свяжитесь с клиентом${order.customer_phone ? `: ${order.customer_phone}` : ""}. Адрес и изделия доступны в заказе.`}>
                <OpenOrderButton orderId={order.id} />
              </OrderTaskCard>
            ))}
            {installationOrders.length === 0 ? <EmptyRoleState text="Нет заказов на установку." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="После установки" count={closingOrders.length} description="Проверьте фотоотчёт, подписанный АВР и готовность к финальной оплате.">
          <div className="grid gap-3">
            {closingOrders.slice(0, 8).map((order) => (
              <OrderTaskCard key={order.id} order={order} nextStep="Если установка завершена, проверьте фотоотчёт и загруженный подписанный АВР.">
                <OpenOrderButton orderId={order.id} />
              </OrderTaskCard>
            ))}
            {closingOrders.length === 0 ? <EmptyRoleState text="Нет заказов после установки с незакрытыми артефактами." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function InstallationWorkPage() {
  return <InstallationWorkspace />;
}
