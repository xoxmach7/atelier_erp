"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDesignerQueue } from "@/hooks/useWorkQueues";
import type { DesignerTask } from "@/services/http/work";
import {
  EmptyRoleState,
  MaterialsList,
  StatusPill,
  TaskSection,
  WorkOrderHeader,
  WorkspaceHeader,
} from "@/components/layout/role-workspace";

function DesignerCard({ task, mode }: { task: DesignerTask; mode: "measurement" | "quote" | "progress" }) {
  const nextStep = mode === "measurement"
    ? "Нужно добавить замер: адрес, размеры, ткань, тюль и метраж."
    : mode === "quote"
      ? "Замер есть. Следующий шаг — собрать КП."
      : "КП уже создано. Следите за согласованием клиента.";

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} right={<StatusPill label={task.status_label} tone="sky" />} />
        {task.installation_address ? <div className="text-sm text-slate-500">Адрес: {task.installation_address}</div> : null}
        <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">{nextStep}</div>
        {mode !== "measurement" ? (
          <MaterialsList items={task.measurement_summary} emptyText="Замеры пока не найдены." />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={task.measurements_url}>Добавить замер</Link>
          </Button>
          {mode !== "measurement" ? (
            <Button asChild size="sm" variant="outline">
              <Link href={task.estimate_url}>Создать КП</Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link href={`/orders/${task.id}?view=designer`}>Открыть заказ</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DesignerWorkspace() {
  const queue = useDesignerQueue();

  if (queue.isLoading) return <LoadingState message="Загрузка кабинета дизайнера..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить задачи дизайнера" description={queue.error?.message || "Проверьте API очереди дизайнера."} />;

  const data = queue.data;

  return (
    <ProtectedRoute>
      <WorkspaceHeader
        title="Дизайнер / замеры"
        description="Дизайнер фиксирует размеры, ткань, тюль и метраж. Стоимость считается позже в КП."
      >
        <Button asChild><Link href="/orders/new">Новый заказ</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Нужен замер" count={data?.needs_measurement.length || 0}>
          <div className="grid gap-3">
            {data?.needs_measurement.map((task) => <DesignerCard key={task.id} task={task} mode="measurement" />)}
            {!data?.needs_measurement.length ? <EmptyRoleState text="Нет заказов без замера." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Замер есть, нужно КП" count={data?.measurement_done_needs_quote.length || 0}>
          <div className="grid gap-3">
            {data?.measurement_done_needs_quote.map((task) => <DesignerCard key={task.id} task={task} mode="quote" />)}
            {!data?.measurement_done_needs_quote.length ? <EmptyRoleState text="Нет замеров, ожидающих КП." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="КП в работе" count={data?.quote_in_progress.length || 0}>
          <div className="grid gap-3">
            {data?.quote_in_progress.map((task) => <DesignerCard key={task.id} task={task} mode="progress" />)}
            {!data?.quote_in_progress.length ? <EmptyRoleState text="Нет заказов с КП в работе." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Просрочено" count={data?.overdue.length || 0}>
          <div className="grid gap-3">
            {data?.overdue.map((task) => <DesignerCard key={task.id} task={task} mode={task.measurement_summary.length ? "quote" : "measurement"} />)}
            {!data?.overdue.length ? <EmptyRoleState text="Просроченных задач дизайнера нет." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function DesignerWorkPage() {
  return <DesignerWorkspace />;
}
