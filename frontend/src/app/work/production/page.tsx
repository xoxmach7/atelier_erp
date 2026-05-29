"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useProductionQueue } from "@/hooks/useWorkQueues";
import type { ProductionTask } from "@/services/http/work";
import {
  EmptyRoleState,
  MaterialsList,
  StatusPill,
  TaskSection,
  WorkOrderHeader,
  WorkspaceHeader,
} from "@/components/layout/role-workspace";
import { Card, CardContent } from "@/components/ui/card";

function ProductionCard({ task }: { task: ProductionTask }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} right={<StatusPill label={task.production_stage_label} tone="green" />} />
        <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Что шить: изделия, размеры, ткань, тюль и комментарии дизайнера ниже.
        </div>
        <MaterialsList items={task.items_to_sew} emptyText="Точный список изделий пока не найден. Откройте заказ и проверьте детали." />
        <div className="flex flex-wrap gap-2">
          {task.actions.can_start_sewing ? <StatusPill label="Можно начать пошив" tone="green" /> : null}
          {task.actions.can_mark_done ? <StatusPill label="Можно отметить готово" tone="amber" /> : null}
          <Button asChild size="sm">
            <Link href={`/orders/${task.id}?view=production`}>Открыть заказ</Link>
          </Button>
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
      <WorkspaceHeader
        title="Швейный цех"
        description="Швея видит реальные изделия в заказах: комнату, окно, размеры, ткань, тюль, метраж и следующий шаг."
      >
        <Button asChild variant="outline"><Link href="/production">Старый экран</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Нужно начать" count={data?.ready_to_start.length || 0} description="Материалы готовы или заказ передан в производство.">
          <div className="grid gap-3">
            {data?.ready_to_start.map((task) => <ProductionCard key={task.id} task={task} />)}
            {!data?.ready_to_start.length ? <EmptyRoleState text="Нет заказов, готовых к запуску в пошив." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="В пошиве" count={data?.in_sewing.length || 0} description="Текущие задачи цеха.">
          <div className="grid gap-3">
            {data?.in_sewing.map((task) => <ProductionCard key={task.id} task={task} />)}
            {!data?.in_sewing.length ? <EmptyRoleState text="Нет заказов в активном пошиве." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Готово к передаче" count={data?.done.length || 0} description="Пошив завершён, заказ можно передавать дальше.">
          <div className="grid gap-3">
            {data?.done.map((task) => <ProductionCard key={task.id} task={task} />)}
            {!data?.done.length ? <EmptyRoleState text="Нет готовых производственных заказов." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function ProductionWorkPage() {
  return <ProductionWorkspace />;
}
