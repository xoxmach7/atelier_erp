"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProductionQueue } from "@/hooks/useWorkQueues";
import type { ProductionTask } from "@/services/http/work";
import { EmptyRoleState, MaterialsList, StatusPill, TaskSection, WorkOrderHeader, WorkspaceHeader } from "@/components/layout/role-workspace";

function ProductionCard({ task }: { task: ProductionTask }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} dotTone={task.production_stage === "done" ? "green" : "sky"} right={<StatusPill label={task.production_stage_label} tone="green" />} />
        <MaterialsList items={task.items_to_sew} emptyText="Позиции заказа ещё не сформированы." />
        <div className="flex flex-wrap items-center gap-2">
          {task.actions.can_start_sewing ? <StatusPill label="следующее: начать пошив" tone="green" /> : null}
          {task.actions.can_mark_done ? <StatusPill label="следующее: отметить готово" tone="amber" /> : null}
          <Button asChild size="sm"><Link href={`/orders/${task.id}?view=production`}>Открыть заказ</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductionWorkspace() {
  const queue = useProductionQueue();

  if (queue.isLoading) return <LoadingState message="Загрузка очереди пошива..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить пошив" description={queue.error?.message || "Проверьте API очереди производства."} />;

  const data = queue.data;

  return (
    <ProtectedRoute>
      <WorkspaceHeader title="Пошив" description="Что шить, из какой ткани и к какому сроку. Без денег и лишних админ-блоков." />

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Нужно начать" count={data?.ready_to_start.length || 0}>
          <div className="grid gap-3">
            {data?.ready_to_start.map((task) => <ProductionCard key={task.id} task={task} />)}
            {!data?.ready_to_start.length ? <EmptyRoleState text="Нет заказов, готовых к запуску в пошив." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="В пошиве" count={data?.in_sewing.length || 0}>
          <div className="grid gap-3">
            {data?.in_sewing.map((task) => <ProductionCard key={task.id} task={task} />)}
            {!data?.in_sewing.length ? <EmptyRoleState text="Нет активных задач швейного цеха." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Готово к передаче" count={data?.done.length || 0}>
          <div className="grid gap-3">
            {data?.done.map((task) => <ProductionCard key={task.id} task={task} />)}
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
