"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ORDER_ROLE_VIEWS, type OrderRoleView } from "./order-helpers";

export function OrderRoleViewSwitcher({ orderId, currentView }: { orderId: string; currentView: OrderRoleView }) {
  return (
    <Card className="mb-6 border-slate-200 bg-white shadow-sm">
      <CardContent className="pt-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Режим просмотра заказа</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ORDER_ROLE_VIEWS.map((view) => (
            <Button
              key={view.value}
              asChild
              size="sm"
              variant={currentView === view.value ? "default" : "outline"}
              className="shrink-0"
            >
              <Link href={`/orders/${orderId}${view.value === "admin" ? "" : `?view=${view.value}`}`}>
                <span className="font-medium">{view.label}</span>
                <span className="ml-2 hidden text-xs opacity-70 sm:inline">{view.helper}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
