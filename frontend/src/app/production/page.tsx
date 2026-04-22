"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Plus, Shirt } from "lucide-react";

export default function ProductionPage() {
  return (
    <>
      <PageHeader
        title="Production"
        description="Manage sewing assignments and track progress"
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Assignment
        </Button>
      </PageHeader>

      <EmptyState
        title="No active assignments"
        description="Create production assignments for orders"
        icon={<Shirt className="h-6 w-6 text-slate-600" />}
        action={{
          label: "Create Assignment",
          onClick: () => {},
        }}
      />
    </>
  );
}
