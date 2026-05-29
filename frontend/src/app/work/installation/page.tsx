"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useInstallationQueue } from "@/hooks/useWorkQueues";
import type { InstallationTask } from "@/services/http/work";
import { EmptyRoleState, MaterialsList, StatusPill, TaskSection, WorkOrderHeader, WorkspaceHeader, formatDate } from "@/components/layout/role-workspace";

function InstallationCard({ task }: { task: InstallationTask }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} right={<StatusPill label={task.handover_stage_label} tone="sky" />} />
        <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <div><span className="font-medium">Телефон:</span> {task.customer_phone || "не указан"}</div>
          <div><span className="font-medium">Адрес:</span> {task.installation_address || "адрес не указан"}</div>
          <div><span className="font-medium">Дата:</span> {formatDate(task.installation_date || task.planned_completion_date)}</div>
        </div>
        <MaterialsList items={task.items_to_install} emptyText="Позиции для установки ещё не сформированы." />
        <div className="flex flex-wrap gap-2">
          <StatusPill label={task.photo_report_count > 0 ? `фото: ${task.photo_report_count}` : "фото нет"} tone={task.photo_report_count > 0 ? "green" : "amber"} />
          <StatusPill label={task.completion_act_status === "missing" ? "АВР нет" : "АВР создан"} tone={task.completion_act_status === "missing" ? "amber" : "green"} />
          <StatusPill label={task.signed_act_uploaded ? "подписан" : "подпись нужна"} tone={task.signed_act_uploaded ? "green" : "amber"} />
          <Button asChild size="sm"><Link href={`/orders/${task.id}?view=installation`}>Открыть заказ</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InstallationWorkspace() {
  const queue = useInstallationQueue();

  if (queue.isLoading) return <LoadingState message="Загрузка установки..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить установку" description={queue.error?.message || "Проверьте API очереди установки."} />;

  const data = queue.data;

  return (
    <ProtectedRoute>
      <WorkspaceHeader title="Установка" description="Куда ехать, кому звонить, что установить и что закрыть после установки." />

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Готово к выезду" count={data?.ready_for_installation.length || 0}>
          <div className="grid gap-3">
            {data?.ready_for_installation.map((task) => <InstallationCard key={task.id} task={task} />)}
            {!data?.ready_for_installation.length ? <EmptyRoleState text="Нет заказов, готовых к установке." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="В установке" count={data?.in_installation.length || 0}>
          <div className="grid gap-3">
            {data?.in_installation.map((task) => <InstallationCard key={task.id} task={task} />)}
            {!data?.in_installation.length ? <EmptyRoleState text="Нет активных установок." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Нужны фото или АВР" count={data?.needs_photo_or_avr.length || 0}>
          <div className="grid gap-3">
            {data?.needs_photo_or_avr.map((task) => <InstallationCard key={task.id} task={task} />)}
            {!data?.needs_photo_or_avr.length ? <EmptyRoleState text="Нет заказов с незакрытыми фото или АВР." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="После установки" count={data?.waiting_final_payment.length || 0}>
          <div className="grid gap-3">
            {data?.waiting_final_payment.map((task) => <InstallationCard key={task.id} task={task} />)}
            {!data?.waiting_final_payment.length ? <EmptyRoleState text="Нет заказов после установки." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function InstallationWorkPage() {
  return <InstallationWorkspace />;
}
