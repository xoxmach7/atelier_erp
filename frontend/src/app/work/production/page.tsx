"use client";
import { useRouter } from "next/navigation";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProductionQueue } from "@/hooks/useWorkQueues";
import { changeProductionStage } from "@/services/http/orders";
import type { ProductionTask } from "@/services/http/work";
import { EmptyRoleState, MaterialsList, StatusPill, TaskSection, WorkOrderHeader, WorkspaceHeader } from "@/components/layout/role-workspace";
import { Loader2 } from "lucide-react";

function ProductionCard({
  task,
  onStartSewing,
  onMarkDone,
  pendingId,
}: {
  task: ProductionTask;
  onStartSewing?: (id: string) => void;
  onMarkDone?: (id: string) => void;
  pendingId?: string | null;
}) {
  const isPending = pendingId === task.id;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} dotTone={task.production_stage === "done" ? "green" : "sky"} right={<StatusPill label={task.production_stage_label} tone="green" />} />
        <MaterialsList items={task.items_to_sew} emptyText="Позиции заказа ещё не сформированы." />
        <div className="flex flex-wrap items-center gap-2">
          {task.actions.can_start_sewing ? <StatusPill label="следующее: начать пошив" tone="green" /> : null}
          {task.actions.can_mark_done ? <StatusPill label="следующее: отметить готово" tone="amber" /> : null}
          {task.actions.can_start_sewing && (
            <Button size="sm" disabled={isPending} onClick={() => onStartSewing?.(task.id)}>
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Начать пошив
            </Button>
          )}
          {task.actions.can_mark_done && (
            <Button size="sm" className="bg-[#16A34A] hover:bg-[#15803D] text-white" disabled={isPending} onClick={() => onMarkDone?.(task.id)}>
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Отметить готово
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductionWorkspace() {
  const queue = useProductionQueue();
  const queryClient = useQueryClient();

  const stageMutation = useMutation({
    mutationFn: ({ orderId, stage }: { orderId: string; stage: string }) =>
      changeProductionStage(orderId, { production_stage: stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-queues", "production"] });
    },
  });

  const pendingId = stageMutation.isPending ? stageMutation.variables?.orderId : null;

  if (queue.isLoading) return <LoadingState message="Загрузка очереди пошива..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить пошив" description={queue.error?.message || "Проверьте API очереди производства."} />;

  const data = queue.data;

  const router = useRouter();

  return (
    <ProtectedRoute>
      <WorkspaceHeader title="Пошив" description="Что шить, из какой ткани и к какому сроку."  onBack={() => router.back()} />

      <div className="grid gap-6 xl:grid-cols-3">
        <TaskSection title="Нужно начать" count={data?.ready_to_start.length || 0}>
          <div className="grid gap-3">
            {data?.ready_to_start.map((task) => (
              <ProductionCard
                key={task.id}
                task={task}
                onStartSewing={(id) => stageMutation.mutate({ orderId: id, stage: "sewing" })}
                pendingId={pendingId}
              />
            ))}
            {!data?.ready_to_start.length ? <EmptyRoleState text="Нет заказов, готовых к запуску в пошив." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="В пошиве" count={data?.in_sewing.length || 0}>
          <div className="grid gap-3">
            {data?.in_sewing.map((task) => (
              <ProductionCard
                key={task.id}
                task={task}
                onMarkDone={(id) => stageMutation.mutate({ orderId: id, stage: "done" })}
                pendingId={pendingId}
              />
            ))}
            {!data?.in_sewing.length ? <EmptyRoleState text="Нет активных задач швейного цеха." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Готово к передаче" count={data?.done.length || 0}>
          <div className="grid gap-3">
            {data?.done.map((task) => (
              <ProductionCard key={task.id} task={task} pendingId={pendingId} />
            ))}
            {!data?.done.length ? <EmptyRoleState text="Нет заказов, готовых к передаче дальше." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function ProductionWorkPage() {
  return <ProductionWorkspace />;
}
