"use client";

import {
  PageHeader,
  EmptyState,
  LoadingState,
  StatusBadge,
  ErrorState,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useOrder } from "@/hooks/useOrders";
import type { OrderDetailDTO, OrderItemDTO } from "@/types";
import {
  ArrowLeft,
  Edit,
  Package,
  MapPin,
  Calendar,
  User,
  Phone,
  CreditCard,
  FileText,
  Calculator,
  Ruler,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

function formatCurrency(value: string | null): string {
  if (!value) return "₸ 0";
  return `₸ ${parseFloat(value).toLocaleString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function OrderItemRow({ item }: { item: OrderItemDTO }) {
  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0">
      <div className="flex-1">
        <div className="font-medium">{item.description}</div>
        <div className="text-sm text-slate-500 mt-1">
          {item.item_type}
          {item.fabric && ` • ${item.fabric}`}
          {item.fabric_meters && ` • ${item.fabric_meters}м`}
          {item.cornice && ` • ${item.cornice}`}
          {item.service && ` • ${item.service}`}
        </div>
      </div>
      <div className="text-right ml-4">
        <div className="font-medium">
          {item.quantity} × {formatCurrency(item.unit_price)}
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {formatCurrency(item.total_price)}
        </div>
      </div>
    </div>
  );
}

function FinancialSummary({ order }: { order: OrderDetailDTO }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Financial Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-600">Total Amount</span>
          <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Paid Amount</span>
          <span className="font-medium text-green-600">{formatCurrency(order.paid_amount)}</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-slate-900 font-medium">Balance Due</span>
          <span className={`font-bold ${parseFloat(order.balance_due) > 0 ? "text-amber-600" : "text-green-600"}`}>
            {formatCurrency(order.balance_due)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerInfo({ order }: { order: OrderDetailDTO }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          Customer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="font-medium text-lg">{order.customer_details.full_name}</div>
        <div className="flex items-center gap-2 text-slate-600">
          <Phone className="h-4 w-4" />
          {order.customer_details.phone}
        </div>
      </CardContent>
    </Card>
  );
}

function InstallationAddress({ order }: { order: OrderDetailDTO }) {
  const parts = [
    order.installation_address_city,
    order.installation_address_street,
    order.installation_address_building,
    order.installation_address_apartment && `кв. ${order.installation_address_apartment}`,
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Installation Address
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>{parts.join(", ")}</div>
        {order.installation_address_notes && (
          <div className="text-sm text-slate-500 italic">
            {order.installation_address_notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderDates({ order }: { order: OrderDetailDTO }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Dates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Measurement</span>
          <span>{formatDate(order.measurement_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Installation</span>
          <span>{formatDate(order.installation_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Planned Completion</span>
          <span>{formatDate(order.planned_completion)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Actual Completion</span>
          <span>{formatDate(order.actual_completion)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderItems({ items }: { items: OrderItemDTO[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Order Items ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No items</div>
        ) : (
          <div>
            {items.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderNotes({ notes }: { notes: string | null }) {
  if (!notes) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm whitespace-pre-wrap">{notes}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Order Quick Actions - CTA cards for related modules
 * These are contextual navigation links that help users move between modules
 */
function OrderQuickActions({ orderId }: { orderId: string }) {
  const actions = [
    {
      title: "Estimate",
      description: "Calculate fabric costs",
      icon: Calculator,
      href: "/estimate",
      variant: "default" as const,
    },
    {
      title: "Measurements",
      description: "View or record measurements",
      icon: Ruler,
      href: "/measurements",
      variant: "outline" as const,
    },
    {
      title: "Payments",
      description: "Record and track payments",
      icon: CreditCard,
      href: "/payments",
      variant: "outline" as const,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className={`group flex flex-col items-start gap-2 p-3 rounded-lg border transition-all hover:shadow-md ${
                  action.variant === "default"
                    ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Icon className="h-5 w-5" />
                  <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <div className="font-medium text-sm">{action.title}</div>
                  <div className={`text-xs ${action.variant === "default" ? "text-slate-300" : "text-slate-500"}`}>
                    {action.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Links open in separate workflows (not yet linked to this order)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderMetadata({ order }: { order: OrderDetailDTO }) {
  return (
    <div className="text-xs text-slate-400 mt-4">
      Created: {formatDateTime(order.created_at)} • Updated: {formatDateTime(order.updated_at)}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, isLoading, isError, error } = useOrder(orderId || null);

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader
          title={`Order ${orderId}`}
          description="Loading order details..."
        >
          <Button variant="outline" disabled>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </PageHeader>
        <LoadingState message="Loading order details..." />
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <PageHeader
          title={`Order ${orderId}`}
          description="Error loading order"
        >
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
        </PageHeader>

        <ErrorState
          title="Failed to load order"
          description={error?.message || "Something went wrong. Please try again later."}
        />
      </>
    );
  }

  // Not found state
  if (!order) {
    return (
      <>
        <PageHeader
          title="Order Not Found"
          description="The requested order could not be found"
        >
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
        </PageHeader>

        <EmptyState
          title="Order not found"
          description={`Order with ID "${orderId}" does not exist or has been deleted.`}
          icon={<Package className="h-6 w-6 text-slate-600" />}
          action={{
            label: "Go to Orders",
            onClick: () => window.location.href = "/orders",
          }}
        />
      </>
    );
  }

  // Data state
  return (
    <>
      <PageHeader
        title={order.order_number}
        description={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            <span className="text-slate-500">• Created {formatDate(order.created_at)}</span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button disabled>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions - contextual navigation */}
          <OrderQuickActions orderId={order.id} />
          <OrderItems items={order.items} />
          <OrderNotes notes={order.notes} />
          <OrderMetadata order={order} />
        </div>

        {/* Right column - Sidebar info */}
        <div className="space-y-6">
          <CustomerInfo order={order} />
          <FinancialSummary order={order} />
          <OrderDates order={order} />
          <InstallationAddress order={order} />
        </div>
      </div>
    </>
  );
}
