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
import type { OrderDetailDTO, OrderItemDTO, MeasurementDTO, PaymentDTO, TaskStatus } from "@/types";
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
  Plus,
  CheckCircle,
  Clock,
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
 * Contextual navigation with order prefill where supported
 */
function OrderQuickActions({ orderId, customerId }: { orderId: string; customerId: string }) {
  const actions = [
    {
      title: "Estimate",
      description: "Create quote for customer",
      icon: Calculator,
      href: `/estimate?customer=${customerId}`,
      variant: "default" as const,
    },
    {
      title: "Measurements",
      description: "View or add measurements",
      icon: Ruler,
      href: `/measurements?order=${orderId}`,
      variant: "outline" as const,
    },
    {
      title: "Payments",
      description: "Record payment",
      icon: CreditCard,
      href: `/payments?order=${orderId}`,
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
            Prefills context where supported
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

/**
 * Measurements Section - Shows related measurements for this order
 */
function MeasurementsSection({ orderId, measurements }: { orderId: string; measurements: MeasurementDTO[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Measurements
            {measurements.length > 0 && (
              <span className="text-sm font-normal text-slate-500">({measurements.length})</span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/measurements?order=${orderId}`}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {measurements.length === 0 ? (
          <div className="text-sm text-slate-500">
            No measurements recorded.
            <Link href={`/measurements?order=${orderId}`} className="ml-2 text-blue-600 hover:underline">
              Create measurement
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {measurements.slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium">{m.room_name}</div>
                  <div className="text-xs text-slate-500">
                    {m.width_cm}×{m.height_cm} cm • {m.mounting_type || "No mounting"}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {formatDate(m.measured_at)}
                </div>
              </div>
            ))}
            {measurements.length > 3 && (
              <Link 
                href={`/measurements?order=${orderId}`}
                className="text-sm text-blue-600 hover:underline block pt-2"
              >
                View all {measurements.length} measurements →
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Payments Section - Shows related payments for this order
 */
function PaymentsSection({ orderId, payments, totalPaid, balanceDue }: { 
  orderId: string; 
  payments: PaymentDTO[];
  totalPaid: string;
  balanceDue: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
            {payments.length > 0 && (
              <span className="text-sm font-normal text-slate-500">({payments.length})</span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/payments?order=${orderId}`}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Payment Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Total Paid</div>
            <div className="font-semibold text-green-600">{formatCurrency(totalPaid)}</div>
          </div>
          <div>
            <div className="text-slate-500">Balance Due</div>
            <div className={`font-semibold ${parseFloat(balanceDue) > 0 ? "text-amber-600" : "text-green-600"}`}>
              {formatCurrency(balanceDue)}
            </div>
          </div>
        </div>
        
        {/* Recent Payments */}
        {payments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              {payments.slice(0, 2).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{p.payment_type}</span>
                  </div>
                  <div className="font-medium">{formatCurrency(p.amount)}</div>
                </div>
              ))}
              {payments.length > 2 && (
                <Link 
                  href={`/payments?order=${orderId}`}
                  className="text-sm text-blue-600 hover:underline block pt-1"
                >
                  View all {payments.length} payments →
                </Link>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Source Task Section - Shows originating task if converted from task
 */
function SourceTaskSection({ sourceTask }: { sourceTask: { id: string; task_number: string; client_name: string; status: string } | null }) {
  if (!sourceTask) return null;

  return (
    <Card className="bg-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Source Task
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{sourceTask.task_number}</div>
            <div className="text-sm text-slate-500">{sourceTask.client_name}</div>
          </div>
          <StatusBadge status={sourceTask.status as TaskStatus} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Related Quotes Section - Honest limitation: quotes are linked to customer/task, not order
 */
function RelatedQuotesSection({ order }: { order: OrderDetailDTO }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Quotes / Estimates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-slate-600">
          Quotes are linked to the customer and source task, not directly to orders.
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href="/estimate">
              <Calculator className="h-4 w-4 mr-2" />
              Open Estimate
            </Link>
          </Button>
        </div>
        {order.source_task && (
          <div className="text-xs text-slate-500">
            Task {order.source_task.task_number} may have related quotes.
          </div>
        )}
      </CardContent>
    </Card>
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
          {/* Workflow hub - contextual navigation */}
          <OrderQuickActions orderId={order.id} customerId={order.customer} />
          
          {/* Related Measurements */}
          <MeasurementsSection 
            orderId={order.id} 
            measurements={order.measurements || []} 
          />
          
          {/* Order Items */}
          <OrderItems items={order.items} />
          <OrderNotes notes={order.notes} />
          <OrderMetadata order={order} />
        </div>

        {/* Right column - Sidebar info */}
        <div className="space-y-6">
          {/* Source Task (if converted from task) */}
          <SourceTaskSection sourceTask={order.source_task} />
          
          {/* Related Payments */}
          <PaymentsSection 
            orderId={order.id}
            payments={order.payments || []}
            totalPaid={order.paid_amount}
            balanceDue={order.balance_due}
          />
          
          <CustomerInfo order={order} />
          <FinancialSummary order={order} />
          <OrderDates order={order} />
          <InstallationAddress order={order} />
          
          {/* Related Quotes - honest limitation */}
          <RelatedQuotesSection order={order} />
        </div>
      </div>
    </>
  );
}
