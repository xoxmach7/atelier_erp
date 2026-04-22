"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ErrorState,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePayments } from "@/hooks/usePayments";
import type { PaymentDTO, PaymentType, PaymentMethod } from "@/types";
import { Plus, CreditCard, Wallet, Banknote, CreditCard as CardIcon, ArrowRightLeft } from "lucide-react";
import Link from "next/link";

function formatCurrency(value: string | null): string {
  if (!value) return "₸ 0";
  return `₸ ${parseFloat(value).toLocaleString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function PaymentsContent() {
  const { data, isLoading, isError, error } = usePayments();

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader title="Payments" description="Manage and track payments">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        </PageHeader>
        <LoadingState message="Loading payments..." />
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <PageHeader title="Payments" description="Manage and track payments">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        </PageHeader>

        <ErrorState
          title="Failed to load payments"
          description={error?.message || "Something went wrong. Please try again later."}
        />
      </>
    );
  }

  const payments: PaymentDTO[] = data?.results || [];

  // Empty state
  if (payments.length === 0) {
    return (
      <>
        <PageHeader title="Payments" description="Manage and track payments">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        </PageHeader>

        <EmptyState
          title="No payments recorded"
          description="Record payments to track order transactions"
          icon={<CreditCard className="h-6 w-6 text-slate-600" />}
          action={{
            label: "Record First Payment",
            onClick: () => {},
          }}
        />
      </>
    );
  }

  // Calculate total
  const totalAmount = payments.reduce((sum: number, p: PaymentDTO) => sum + parseFloat(p.amount), 0);

  // Data table
  return (
    <>
      <PageHeader
        title="Payments"
        description={`${data?.count || 0} payments recorded`}
      >
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Method</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Received</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Recorded By</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((payment: PaymentDTO) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${payment.order}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {payment.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentTypeBadgeColor(payment.payment_type)}`}>
                        {getPaymentTypeLabel(payment.payment_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(payment.payment_method)}
                        <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {payment.received_at ? (
                        <span className="text-green-600">
                          {formatDate(payment.received_at)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {payment.created_by_name || payment.created_by}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={payment.notes || undefined}>
                      {truncateNotes(payment.notes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.count > 0 && (
            <div className="border-t px-4 py-3 text-sm text-slate-500 flex justify-between">
              <span>Showing {payments.length} of {data.count} payments</span>
              <span className="font-medium">Total: {formatCurrency(String(totalAmount))}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function getPaymentTypeLabel(type: PaymentType): string {
  const labels: Record<PaymentType, string> = {
    prepayment: "Prepayment",
    final: "Final Payment",
    additional: "Additional",
  };
  return labels[type] || type;
}

function getPaymentTypeBadgeColor(type: PaymentType): string {
  const colors: Record<PaymentType, string> = {
    prepayment: "bg-amber-100 text-amber-800",
    final: "bg-green-100 text-green-800",
    additional: "bg-blue-100 text-blue-800",
  };
  return colors[type] || "bg-slate-100 text-slate-800";
}

function getPaymentMethodIcon(method: PaymentMethod): React.ReactNode {
  const icons: Record<PaymentMethod, React.ReactNode> = {
    cash: <Wallet className="h-4 w-4" />,
    card: <CardIcon className="h-4 w-4" />,
    transfer: <ArrowRightLeft className="h-4 w-4" />,
  };
  return icons[method] || <Banknote className="h-4 w-4" />;
}

function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    cash: "Cash",
    card: "Card",
    transfer: "Bank Transfer",
  };
  return labels[method] || method;
}

function truncateNotes(notes: string | null, maxLength: number = 40): string {
  if (!notes) return "—";
  if (notes.length <= maxLength) return notes;
  return notes.substring(0, maxLength) + "…";
}

export default function PaymentsPage() {
  return (
    <ProtectedRoute>
      <PaymentsContent />
    </ProtectedRoute>
  );
}
