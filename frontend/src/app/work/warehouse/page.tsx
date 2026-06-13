"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWarehouseQueue } from "@/hooks/useWorkQueues";
import { sendToProduction } from "@/services/http/orders";
import type { WarehouseTask } from "@/services/http/work";
import { EmptyRoleState, MaterialsList, StatusPill, TaskSection, WorkOrderHeader, WorkspaceHeader } from "@/components/layout/role-workspace";
import { Loader2 } from "lucide-react";

function WarehouseCard({
  task,
  onSendToProduction,
  isPending,
}: {
  task: WarehouseTask;
  onSendToProduction?: (id: string) => void;
  isPending?: boolean;
}) {
  const tone = task.material_readiness === "ready" ? "green" : task.material_readiness === "partially_ready" ? "amber" : "red";

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} dotTone={tone} right={<StatusPill label={task.material_readiness_label} tone={tone} />} />
        <MaterialsList items={task.selected_materials} emptyText="Материалы по заказу ещё не выбраны." />
        {task.material_readiness === "ready" && (
          <Button
            size="sm"
            className="bg-[#16A34A] hover:bg-[#15803D] text-white"
            disabled={isPending}
            onClick={() => onSendToProduction?.(task.id)}
          >
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Передать в цех
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function WarehouseWorkspace() {
  const queue = useWarehouseQueue();
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: (orderId: string) => sendToProduction(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-queues", "warehouse"] });
    },
  });

  if (queue.isLoading) return <LoadingState message="Загрузка склада..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить склад" description={queue.error?.message || "Проверьте API очереди склада."} />;

  const data = queue.data;

  return (
    <ProtectedRoute>
      <WorkspaceHeader title="Склад" description="Какие материалы нужны по заказам и что уже готово." />

      <div className="grid gap-6 xl:grid-cols-3">
        <TaskSection title="Не готово" count={data?.not_ready.length || 0}>
          <div className="grid gap-3">
            {data?.not_ready.map((task) => <WarehouseCard key={task.id} task={task} />)}
            {!data?.not_ready.length ? <EmptyRoleState text="Нет заказов с неготовыми материалами." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Частично готово" count={data?.partially_ready.length || 0}>
          <div className="grid gap-3">
            {data?.partially_ready.map((task) => <WarehouseCard key={task.id} task={task} />)}
            {!data?.partially_ready.length ? <EmptyRoleState text="Нет частично обеспеченных заказов." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Готово к передаче" count={data?.ready.length || 0}>
          <div className="grid gap-3">
            {data?.ready.map((task) => (
              <WarehouseCard
                key={task.id}
                task={task}
                onSendToProduction={(id) => sendMutation.mutate(id)}
                isPending={sendMutation.isPending && sendMutation.variables === task.id}
              />
            ))}
            {!data?.ready.length ? <EmptyRoleState text="Нет заказов с готовыми материалами." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function WarehouseWorkPage() {
  return <WarehouseWorkspace />;
}
