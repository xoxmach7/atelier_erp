"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMemo } from "react";
import type { FabricDTO, EstimateRoom } from "@/types";
import { formatCurrency, formatMeters, calculateEstimateSummary } from "../utils/estimateHelpers";
import { Calculator, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SummaryPanelProps {
  rooms: EstimateRoom[];
  fabrics: FabricDTO[];
  onReset: () => void;
}

export function SummaryPanel({ rooms, fabrics, onReset }: SummaryPanelProps) {
  const summary = useMemo(
    () => calculateEstimateSummary(rooms, fabrics),
    [rooms, fabrics]
  );

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Estimate Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Items:</span>
            <span className="font-medium">{summary.itemCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Rooms:</span>
            <span className="font-medium">{rooms.length}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Curtain fabrics:</span>
            <span className="font-medium">{formatCurrency(summary.totalCurtainCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Tulle fabrics:</span>
            <span className="font-medium">{formatCurrency(summary.totalTulleCost)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between text-lg font-bold">
          <span>Total:</span>
          <span className="text-slate-900">{formatCurrency(summary.totalCost)}</span>
        </div>

        {summary.warnings.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">Stock Warnings</span>
              </div>
              <ul className="text-xs text-amber-700 space-y-1">
                {summary.warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {summary.warnings.length === 0 && summary.itemCount > 0 && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>All fabrics in stock</span>
          </div>
        )}

        {rooms.length > 0 && (
          <>
            <Separator />
            <Button variant="outline" size="sm" onClick={onReset} className="w-full text-red-600">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Estimate
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
