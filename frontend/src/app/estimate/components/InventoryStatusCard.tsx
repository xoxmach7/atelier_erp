"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

interface InventoryStatusCardProps {
  fabricsCount: number;
}

export function InventoryStatusCard({ fabricsCount }: InventoryStatusCardProps) {
  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" />
          Inventory Status
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">
        <p>{fabricsCount} fabrics loaded from inventory</p>
        <p className="text-xs text-slate-400 mt-1">
          Prices and availability are up-to-date with current stock.
        </p>
      </CardContent>
    </Card>
  );
}
