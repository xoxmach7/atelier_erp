"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ErrorState,
  WorkflowInfoCard,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFabrics } from "@/hooks/useFabrics";
import type { FabricDTO } from "@/types";
import { Plus, Package, Calculator } from "lucide-react";
import Link from "next/link";

function formatCurrency(value: string | null): string {
  if (!value) return "₸ 0";
  return `₸ ${parseFloat(value).toLocaleString()}`;
}

function formatMeters(value: string | null): string {
  if (!value) return "0 м";
  return `${parseFloat(value).toFixed(1)} м`;
}

function StockIndicator({ fabric }: { fabric: FabricDTO }) {
  const available = parseFloat(fabric.available_meters);
  const stock = parseFloat(fabric.stock_meters);

  if (available <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Out of stock
      </span>
    );
  }

  if (available < 10) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        Low stock
      </span>
    );
  }

  if (available / stock < 0.3) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        Low stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
      In stock
    </span>
  );
}

function InventoryContent() {
  const { data, isLoading, isError, error } = useFabrics();
  const fabrics: FabricDTO[] = data?.results || [];

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Inventory"
          description="Track fabrics, materials, and stock levels"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Fabric
          </Button>
        </PageHeader>
        <LoadingState message="Loading inventory..." />
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <PageHeader
          title="Inventory"
          description="Track fabrics, materials, and stock levels"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Fabric
          </Button>
        </PageHeader>

        <ErrorState
          title="Failed to load inventory"
          description={error?.message || "Something went wrong. Please try again later."}
          context={`Make sure the backend is running at ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}`}
        />
      </>
    );
  }

  // Empty state
  if (fabrics.length === 0) {
    return (
      <>
        <PageHeader
          title="Inventory"
          description="Track fabrics, materials, and stock levels"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Fabric
          </Button>
        </PageHeader>

        <EmptyState
          title="No fabrics in inventory"
          description="Add fabrics to your inventory to start tracking stock levels"
          icon={<Package className="h-6 w-6 text-slate-600" />}
          action={{
            label: "Add First Fabric",
            onClick: () => {},
          }}
        />
      </>
    );
  }

  // Data table with fabrics
  return (
    <>
      <PageHeader
        title="Inventory"
        description={`${data?.count || 0} fabrics in stock`}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/estimate">
              <Calculator className="mr-2 h-4 w-4" />
              Go to Estimate
            </Link>
          </Button>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Fabric
          </Button>
        </div>
      </PageHeader>

      {/* Contextual info card - links Inventory to Estimate workflow */}
      <div className="mb-6">
        <WorkflowInfoCard
          title="Inventory → Estimate Workflow"
          description={
            <>
              Fabrics shown here are available in the{" "}
              <Link href="/estimate" className="underline hover:text-blue-800">
                Estimate Builder
              </Link>
              . Low stock items are highlighted.
            </>
          }
          icon={<Calculator className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Hanger #</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Fabric</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Color</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Stock</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Reserved</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Available</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Price/m</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fabrics.map((fabric) => (
                  <tr
                    key={fabric.id}
                    className={`hover:bg-slate-50 ${!fabric.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {fabric.hanger_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{fabric.name}</div>
                      <div className="text-xs text-slate-500">{fabric.composition} • {fabric.width_cm}cm</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full border border-slate-200"
                          style={{ backgroundColor: fabric.color.toLowerCase() }}
                          title={fabric.color}
                        />
                        <span>{fabric.color}</span>
                        {fabric.pattern && (
                          <span className="text-xs text-slate-500">({fabric.pattern})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMeters(fabric.stock_meters)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {formatMeters(fabric.reserved_meters)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      <span className={parseFloat(fabric.available_meters) <= 0 ? "text-red-600" : ""}>
                        {formatMeters(fabric.available_meters)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(fabric.price_per_meter)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockIndicator fabric={fabric} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.count > 0 && (
            <div className="border-t px-4 py-3 text-sm text-slate-500">
              Showing {fabrics.length} of {data.count} fabrics
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function InventoryPage() {
  return (
    <ProtectedRoute>
      <InventoryContent />
    </ProtectedRoute>
  );
}
