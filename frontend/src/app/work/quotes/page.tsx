"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";
import { EmptyRoleState, TaskSection, WorkspaceHeader, customerName, formatMoney, orderNumber } from "@/components/layout/role-workspace";

function QuotesWorkspace() {
  const ordersQuery = useOrders({ pageSize: 100 });
  const quotesQuery = useQuotes({ pageSize: 100 });

  if (ordersQuery.isLoading || quotesQuery.isLoading) return <LoadingState message="Загрузка КП..." />;
  if (quotesQuery.isError) return <ErrorState title="Не удалось загрузить КП" description={quotesQuery.error?.message || "Проверьте API КП."} />;

  const orders = ordersQuery.data?.results || [];
  const quotes = quotesQuery.data?.results || [];
  const quoteOrderIds = new Set(quotes.map((quote) => quote.converted_order?.id).filter(Boolean));
  const ordersWithoutQuote = orders.filter((order) => ["new", "in_work"].includes(order.status) && !quoteOrderIds.has(order.id));
  const draftQuotes = quotes.filter((quote) => quote.status === "draft");
  const approvedQuotes = quotes.filter((quote) => quote.status === "approved");

  return (
    <>
      <WorkspaceHeader
        title="КП / Расчёты"
        description="КП — место расчёта стоимости. Замер даёт параметры, а цены вводятся здесь."
      >
        <Button asChild><Link href="/estimate">Создать КП</Link></Button>
        <Button asChild variant="outline"><Link href="/quotes">Все КП</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <TaskSection title="Можно создать КП" count={ordersWithoutQuote.length}>
          <div className="grid gap-3">
            {ordersWithoutQuote.slice(0, 8).map((order) => (
              <Card key={order.id} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="font-semibold text-slate-950">{orderNumber(order)}</div>
                  <div className="mt-1 text-sm text-slate-600">{customerName(order)}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm"><Link href={`/estimate?customer=${order.customer}&order=${order.id}`}>Создать КП</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link href={`/orders/${order.id}?view=designer`}>Открыть заказ</Link></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {ordersWithoutQuote.length === 0 ? <EmptyRoleState text="Нет заказов для нового КП." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Черновики КП" count={draftQuotes.length}>
          <div className="grid gap-3">
            {draftQuotes.slice(0, 8).map((quote) => (
              <Card key={quote.id} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{quote.quote_number || "КП без номера"}</div>
                      <div className="mt-1 text-sm text-slate-600">{quote.customer_name || "Клиент не указан"}</div>
                      <div className="mt-1 text-sm text-slate-500">Итого: {formatMoney(quote.total)}</div>
                    </div>
                    <Badge variant="outline">{quote.items?.length || 0} поз.</Badge>
                  </div>
                  <Button asChild size="sm" className="mt-3"><Link href={`/quotes/${quote.id}`}>Открыть КП</Link></Button>
                </CardContent>
              </Card>
            ))}
            {draftQuotes.length === 0 ? <EmptyRoleState text="Черновиков КП нет." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Принятые / согласованные" count={approvedQuotes.length}>
          <div className="grid gap-3">
            {approvedQuotes.slice(0, 8).map((quote) => (
              <Card key={quote.id} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="font-semibold text-slate-950">{quote.quote_number || "КП без номера"}</div>
                  <div className="mt-1 text-sm text-slate-600">{quote.customer_name || "Клиент не указан"}</div>
                  <div className="mt-1 text-sm text-slate-500">Итого: {formatMoney(quote.total)}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={quote.status} />
                    <Button asChild size="sm" variant="outline"><Link href={`/quotes/${quote.id}`}>Открыть</Link></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {approvedQuotes.length === 0 ? <EmptyRoleState text="Согласованных КП пока нет." /> : null}
          </div>
        </TaskSection>
      </div>
    </>
  );
}

export default function QuotesWorkPage() {
  return (
    <ProtectedRoute>
      <QuotesWorkspace />
    </ProtectedRoute>
  );
}
