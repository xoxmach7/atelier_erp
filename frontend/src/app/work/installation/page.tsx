"use client";
import { useRouter } from "next/navigation";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useInstallationQueue } from "@/hooks/useWorkQueues";
import { changeHandoverStage } from "@/services/http/orders";
import type { InstallationTask } from "@/services/http/work";
import { formatAddress } from "@/utils/formatAddress";
import { EmptyRoleState, MaterialsList, StatusPill, TaskSection, WorkOrderHeader, WorkspaceHeader, formatDate } from "@/components/layout/role-workspace";
import { Loader2 } from "lucide-react";

function InstallationCard({
  task,
  onStartInstallation,
  onFinishInstallation,
  pendingId,
}: {
  task: InstallationTask;
  onStartInstallation?: (id: string) => void;
  onFinishInstallation?: (id: string) => void;
  pendingId?: string | null;
}) {
  const isPending = pendingId === task.id;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} right={<StatusPill label={task.handover_stage_label} tone="sky" />} />
        <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <div><span className="font-medium">Телефон:</span> {task.customer_phone || "не указан"}</div>
          <div><span className="font-medium">Адрес:</span> {formatAddress(task.installation_address) || "адрес не указан"}</div>
          <div><span className="font-medium">Дата:</span> {formatDate(task.installation_date || task.planned_completion_date)}</div>
        </div>
        <MaterialsList items={task.items_to_install} emptyText="Позиции для установки ещё не сформированы." />
        <div className="flex flex-wrap gap-2">
          <StatusPill label={task.photo_report_count > 0 ? "фото: " + task.photo_report_count : "фото нет"} tone={task.photo_report_count > 0 ? "green" : "amber"} />
          <StatusPill label={task.completion_act_status === "missing" ? "АВР нет" : "АВР создан"} tone={task.completion_act_status === "missing" ? "amber" : "green"} />
          <StatusPill label={task.signed_act_uploaded ? "подписан" : "подпись нужна"} tone={task.signed_act_uploaded ? "green" : "amber"} />
          {task.handover_stage === "pending" && (
            <Button size="sm" disabled={isPending} onClick={() => onStartInstallation?.(task.id)}>
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Начать установку
            </Button>
          )}
          {task.handover_stage === "in_progress" && (
            <Button size="sm" className="bg-[#16A34A] hover:bg-[#15803D] text-white" disabled={isPending} onClick={() => onFinishInstallation?.(task.id)}>
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Установка завершена
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InstallationWorkspace() {
  const queue = useInstallationQueue();
  const router = useRouter();
  const queryClient = useQueryClient();

  type HandoverStage = 'not_required' | 'pending' | 'scheduled' | 'in_progress' | 'done';

  const handoverMutation = useMutation({
    mutationFn: ({ orderId, stage }: { orderId: string; stage: HandoverStage }) =>
      changeHandoverStage(orderId, { handover_stage: stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-queues", "installation"] });
    },
  });

  const pendingId = handoverMutation.isPending ? handoverMutation.variables?.orderId : null;

  if (queue.isLoading) return <LoadingState message="Загрузка установки..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить установку" description={queue.error?.message || "Проверьте API очереди установки."} />;

  const data = queue.data;
  const activeInstallation = [...(data?.ready_for_installation ?? []), ...(data?.in_installation ?? [])];

  return (
    <ProtectedRoute>
      <WorkspaceHeader title="Установка" description="Куда ехать, кому звонить, что установить и что закрыть после установки."  onBack={() => router.back()} />

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Готово к установке" count={activeInstallation.length}>
          <div className="grid gap-3">
            {activeInstallation.map((task) => (
              <InstallationCard
                key={task.id}
                task={task}
                onStartInstallation={(id) => handoverMutation.mutate({ orderId: id, stage: "in_progress" })}
                onFinishInstallation={(id) => handoverMutation.mutate({ orderId: id, stage: "done" })}
                pendingId={pendingId}
              />
            ))}
            {!activeInstallation.length ? <EmptyRoleState text="Нет заказов, готовых к установке." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Нужны фото или АВР" count={data?.needs_photo_or_avr.length || 0}>
          <div className="grid gap-3">
            {data?.needs_photo_or_avr.map((task) => (
              <InstallationCard
                key={task.id}
                task={task}
                onFinishInstallation={(id) => handoverMutation.mutate({ orderId: id, stage: "done" })}
                pendingId={pendingId}
              />
            ))}
            {!data?.needs_photo_or_avr.length ? <EmptyRoleState text="Нет незакрытых фото или АВР." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function InstallationWorkPage() {
  return <InstallationWorkspace />;
}
