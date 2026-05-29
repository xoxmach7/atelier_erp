"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuotesQueue } from "@/hooks/useWorkQueues";
import type { DesignerTask, QuoteTask } from "@/services/http/work";
import { EmptyRoleState, MaterialsList, StatusPill, TaskSection, WorkOrderHeader, WorkspaceHeader, formatMoney } from "@/components/layout/role-workspace";

function ReadyForQuoteCard({ task }: { task: DesignerTask }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} />
        <MaterialsList items={task.measurement_summary} emptyText="Замеры не найдены." />
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href={task.estimate_url}>Создать КП</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href={`/orders/${task.id}?view=designer`}>Открыть заказ</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuoteCard({ quote }: { quote: QuoteTask }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-950">{quote.quote_number}</div>
            <div className="mt-1 text-sm text-slate-600">{quote.customer_name}{quote.customer_phone ? ` · ${quote.customer_phone}` : ""}</div>
            <div className="mt-1 text-sm text-slate-500">{quote.items_count} позиций · {formatMoney(quote.total)}</div>
          </div>
          <StatusPill label={quote.status_label} tone={quote.status === "approved" ? "green" : quote.status === "sent" ? "amber" : "slate"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href={quote.quote_url}>Открыть КП</Link></Button>
          {quote.order_id ? <Button asChild size="sm" variant="outline"><Link href={`/orders/${quote.order_id}?view=designer`}>Открыть заказ</Link></Button> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function QuotesWorkspace() {
  const queue = useQuotesQueue();

  if (queue.isLoading) return <LoadingState message="Загрузка КП..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить КП" description={queue.error?.message || "Проверьте API очереди КП."} />;

  const data = queue.data;

  return (
    <ProtectedRoute>
      <WorkspaceHeader title="КП" description="Воронка расчёта: из замера в цену, согласование и запуск заказа в работу." />

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Можно создать КП" count={data?.ready_for_quote.length || 0}>
          <div className="grid gap-3">
            {data?.ready_for_quote.map((task) => <ReadyForQuoteCard key={task.id} task={task} />)}
            {!data?.ready_for_quote.length ? <EmptyRoleState text="Нет замеров, готовых к КП." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Черновики" count={data?.draft_quotes.length || 0}>
          <div className="grid gap-3">
            {data?.draft_quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
            {!data?.draft_quotes.length ? <EmptyRoleState text="Черновиков КП нет." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="На согласовании" count={data?.pending_approval.length || 0}>
          <div className="grid gap-3">
            {data?.pending_approval.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
            {!data?.pending_approval.length ? <EmptyRoleState text="Нет КП на согласовании." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Принятые" count={data?.accepted_quotes.length || 0}>
          <div className="grid gap-3">
            {data?.accepted_quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
            {!data?.accepted_quotes.length ? <EmptyRoleState text="Нет принятых КП." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function QuotesWorkPage() {
  return <QuotesWorkspace />;
}
