"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDesignerQueue } from "@/hooks/useWorkQueues";
import type { DesignerTask } from "@/services/http/work";
import { formatAddress } from "@/utils/formatAddress";
import { EmptyRoleState, MaterialsList, StatusPill, TaskSection, WorkOrderHeader, WorkspaceHeader } from "@/components/layout/role-workspace";
import { CreateMeasurementModal } from "@/components/shared/create-measurement-modal";
import { CreateKPModal } from "@/components/shared/create-kp-modal";

function DesignerCard({
  task,
  mode,
  onOpenMeasurement,
  onOpenKP,
}: {
  task: DesignerTask;
  mode: "measurement" | "quote" | "progress";
  onOpenMeasurement?: (orderId: string) => void;
  onOpenKP?: (orderId: string) => void;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} right={<StatusPill label={task.status_label} tone="sky" />} />
        {task.installation_address ? <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Адрес: {formatAddress(task.installation_address)}</div> : null}
        {mode !== "measurement" ? <MaterialsList items={task.measurement_summary} emptyText="Замер есть, но детали пока не попали в очередь." /> : null}
        <div className="flex flex-wrap gap-2">
          {mode === "measurement" ? (
            <Button size="sm" onClick={() => onOpenMeasurement?.(task.id)}>
              Добавить замер
            </Button>
          ) : null}
          {mode === "quote" ? (
            <Button size="sm" onClick={() => onOpenKP?.(task.id)}>
              Создать КП
            </Button>
          ) : null}
          <Button asChild size="sm" variant={mode === "progress" ? "default" : "outline"}>
            <Link href={`/orders/${task.id}?view=designer`}>Открыть заказ</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DesignerWorkspace() {
  const queue = useDesignerQueue();
  const [measureTarget, setMeasureTarget] = useState<string | null>(null);
  const [kpTarget, setKPTarget] = useState<string | null>(null);

  if (queue.isLoading) return <LoadingState message="Загрузка задач дизайнера..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить задачи дизайнера" description={queue.error?.message || "Проверьте API очереди дизайнера."} />;

  const data = queue.data;

  return (
    <ProtectedRoute>
      <WorkspaceHeader title="Дизайнер" description="Замеры, выбор ткани/тюля и подготовка КП." />

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Нужно добавить замер" count={data?.needs_measurement.length || 0}>
          <div className="grid gap-3">
            {data?.needs_measurement.map((task) => (
              <DesignerCard
                key={task.id}
                task={task}
                mode="measurement"
                onOpenMeasurement={setMeasureTarget}
              />
            ))}
            {!data?.needs_measurement.length ? <EmptyRoleState text="Нет заказов без замера." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Замер есть — создать КП" count={data?.measurement_done_needs_quote.length || 0}>
          <div className="grid gap-3">
            {data?.measurement_done_needs_quote.map((task) => (
              <DesignerCard
                key={task.id}
                task={task}
                mode="quote"
                onOpenKP={setKPTarget}
              />
            ))}
            {!data?.measurement_done_needs_quote.length ? <EmptyRoleState text="Нет замеров, ожидающих КП." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="КП в работе / на согласовании" count={data?.quote_in_progress.length || 0}>
          <div className="grid gap-3">
            {data?.quote_in_progress.map((task) => (
              <DesignerCard key={task.id} task={task} mode="progress" />
            ))}
            {!data?.quote_in_progress.length ? <EmptyRoleState text="Нет заказов с КП в работе." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Просрочено" count={data?.overdue.length || 0}>
          <div className="grid gap-3">
            {data?.overdue.map((task) => (
              <DesignerCard
                key={task.id}
                task={task}
                mode={task.measurement_summary.length ? "quote" : "measurement"}
                onOpenMeasurement={setMeasureTarget}
                onOpenKP={setKPTarget}
              />
            ))}
            {!data?.overdue.length ? <EmptyRoleState text="Просроченных задач дизайнера нет." /> : null}
          </div>
        </TaskSection>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {measureTarget && (
        <CreateMeasurementModal
          isOpen={!!measureTarget}
          onClose={() => setMeasureTarget(null)}
          orderId={measureTarget}
          onSuccess={() => {
            setMeasureTarget(null);
            queue.refetch();
          }}
        />
      )}
      {kpTarget && (
        <CreateKPModal
          isOpen={!!kpTarget}
          onClose={() => setKPTarget(null)}
          orderId={kpTarget}
          onSuccess={() => {
            setKPTarget(null);
            queue.refetch();
          }}
        />
      )}
    </ProtectedRoute>
  );
}

export default function DesignerWorkPage() {
  return <DesignerWorkspace />;
}
