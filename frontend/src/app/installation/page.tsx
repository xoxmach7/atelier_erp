"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Plus, Wrench } from "lucide-react";

export default function InstallationPage() {
  return (
    <>
      <PageHeader
        title="Installation"
        description="Schedule and track curtain installations"
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Installation
        </Button>
      </PageHeader>

      <EmptyState
        title="No installations scheduled"
        description="Schedule installations for completed orders"
        icon={<Wrench className="h-6 w-6 text-slate-600" />}
        action={{
          label: "Schedule Now",
          onClick: () => {},
        }}
      />
    </>
  );
}
