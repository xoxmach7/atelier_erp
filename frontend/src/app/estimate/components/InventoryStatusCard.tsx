"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

interface InventoryStatusCardProps {
  fabricsCount: number;
}

export function InventoryStatusCard({ fabricsCount }: InventoryStatusCardProps) {
  return (
    <Card className="mt-4 bg-[var(--card-sheber)] border-[var(--border-sheber)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-[var(--t1)]">
          <Package className="h-4 w-4 text-[var(--ok)]" />
          Ткани загружены
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-[var(--t2)]">
        <p>{fabricsCount} тканей доступно</p>
        <p className="text-xs text-[var(--t3)] mt-1">
          Цены и наличие актуальны
        </p>
      </CardContent>
    </Card>
  );
}
