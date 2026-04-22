"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";

export default function NewOrderPage() {
  return (
    <>
      <PageHeader
        title="New Order"
        description="Create a new customer order"
      >
        <Button asChild variant="outline">
          <Link href="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </PageHeader>

      <EmptyState
        title="Coming Soon"
        description="Order creation form will be available in Sprint 3"
        icon={<Construction className="h-6 w-6 text-slate-600" />}
        action={{
          label: "Go to Orders",
          onClick: () => window.location.href = "/orders",
        }}
      />
    </>
  );
}
