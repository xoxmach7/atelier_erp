"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Package, Shirt, CreditCard } from "lucide-react";

const stats = [
  { title: "Активные заказы", value: "24", icon: ClipboardList, change: "+2 с прошлой недели" },
  { title: "В производстве", value: "12", icon: Shirt, change: "5 готовы на этой неделе" },
  { title: "Товары на исходе", value: "8", icon: Package, change: "Требует внимания" },
  { title: "Ожидают оплаты", value: "₸ 1.2M", icon: CreditCard, change: "3 заказа" },
];

function DashboardContent() {
  return (
    <>
      <PageHeader
        title="Рабочий стол"
        description="Обзор операций ателье"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-slate-600">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Недавние заказы</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Нет недавних заказов для отображения</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Предстоящие задачи</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Нет предстоящих задач</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
