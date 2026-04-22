"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Package, Shirt, CreditCard } from "lucide-react";

const stats = [
  { title: "Active Orders", value: "24", icon: ClipboardList, change: "+2 from last week" },
  { title: "In Production", value: "12", icon: Shirt, change: "5 ready this week" },
  { title: "Low Stock Items", value: "8", icon: Package, change: "Needs attention" },
  { title: "Pending Payments", value: "₸ 1.2M", icon: CreditCard, change: "3 orders" },
];

function DashboardContent() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your atelier operations"
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
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">No recent orders to display</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">No upcoming tasks</p>
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
