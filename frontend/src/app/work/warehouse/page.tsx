"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarehouseQueue } from "@/hooks/useWorkQueues";
import type { WarehouseTask } from "@/services/http/work";
import { EmptyRoleState, MaterialsList, StatusPill, TaskSection, WorkOrderHeader, WorkspaceHeader, formatMeters } from "@/components/layout/role-workspace";

function WarehouseCard({ task }: { task: WarehouseTask }) {
  const tone = task.material_readiness === "ready" ? "green" : task.material_readiness === "partially_ready" ? "amber" : "red";

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} dotTone={tone} right={<StatusPill label={task.material_readiness_label} tone={tone} />} />
        <MaterialsList items={task.selected_materials} emptyText="Материалы по заказу ещё не выбраны." />
        <Button asChild size="sm"><Link href={`/orders/${task.id}?view=warehouse`}>Открыть заказ</Link></Button>
      </CardContent>
    </Card>
  );
}

function WarehouseWorkspace() {
  const queue = useWarehouseQueue();

  if (queue.isLoading) return <LoadingState message="Загрузка склада..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить склад" description={queue.error?.message || "Проверьте API очереди склада."} />;

  const data = queue.data;

  return (
    <ProtectedRoute>
      <WorkspaceHeader title="Склад" description="Какие материалы нужны по заказам и что уже готово." />

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Не готово" count={data?.not_ready.length || 0}>
          <div className="grid gap-3">
            {data?.not_ready.map((task) => <WarehouseCard key={task.id} task={task} />)}
            {!data?.not_ready.length ? <EmptyRoleState text="Нет заказов с неготовыми материалами." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Частично" count={data?.partially_ready.length || 0}>
          <div className="grid gap-3">
            {data?.partially_ready.map((task) => <WarehouseCard key={task.id} task={task} />)}
            {!data?.partially_ready.length ? <EmptyRoleState text="Нет частично обеспеченных заказов." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Готово" count={data?.ready.length || 0}>
          <div className="grid gap-3">
            {data?.ready.map((task) => <WarehouseCard key={task.id} task={task} />)}
            {!data?.ready.length ? <EmptyRoleState text="Нет заказов с готовыми материалами." /> : null}
          </div>
        </TaskSection>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle className="text-base">Остатки тканей</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.fabrics.slice(0, 10).map((fabric) => (
              <div key={fabric.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-900">{fabric.name}</div>
                <div className="mt-1 text-slate-500">
                  {fabric.hanger_number} · доступно {formatMeters(fabric.available_meters)}
                  {fabric.location ? ` · ${fabric.location}` : ""}
                </div>
              </div>
            ))}
            {!data?.fabrics.length ? <EmptyRoleState text="Остатки тканей пока не найдены." /> : null}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function WarehouseWorkPage() {
  return <WarehouseWorkspace />;
}
