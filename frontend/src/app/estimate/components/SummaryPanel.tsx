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
  isPersisted?: boolean;
}

export function SummaryPanel({ rooms, fabrics, onReset, isPersisted }: SummaryPanelProps) {
  const summary = useMemo(
    () => calculateEstimateSummary(rooms, fabrics),
    [rooms, fabrics]
  );

  return (
    <Card className="sticky top-4 bg-[var(--card-sheber)] border-[var(--border-sheber)] shadow-[var(--sh)] rounded-[var(--rl)]">
      <CardHeader className="pb-3 border-b border-[var(--borderl)]">
        <CardTitle className="flex items-center gap-2 text-[var(--t1)] text-base">
          <Calculator className="h-4 w-4 text-[var(--a)]" />
          Сводка по КП
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Stats */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--t3)]">Позиций:</span>
            <span className="font-medium text-[var(--t1)]">{summary.itemCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--t3)]">Комнат:</span>
            <span className="font-medium text-[var(--t1)]">{rooms.length}</span>
          </div>
        </div>

        <Separator className="bg-[var(--borderl)]" />

        {/* Fabrics */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--t3)]">Ткань штор:</span>
            <span className="font-medium text-[var(--t1)]">{formatCurrency(summary.totalCurtainCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--t3)]">Ткань тюля:</span>
            <span className="font-medium text-[var(--t1)]">{formatCurrency(summary.totalTulleCost)}</span>
          </div>
        </div>

        <Separator className="bg-[var(--borderl)]" />

        {/* Services */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--t3)]">Пошив:</span>
            <span className="font-medium text-[var(--t1)]">{formatCurrency(summary.totalSewingCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--t3)]">Карнизы:</span>
            <span className="font-medium text-[var(--t1)]">{formatCurrency(summary.totalCorniceCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--t3)]">Монтаж:</span>
            <span className="font-medium text-[var(--t1)]">{formatCurrency(summary.totalInstallationCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--t3)]">Доп. услуги:</span>
            <span className="font-medium text-[var(--t1)]">{formatCurrency(summary.totalAdditionalServicesCost)}</span>
          </div>
        </div>

        <Separator className="bg-[var(--borderl)]" />

        {/* Total */}
        <div className="flex justify-between text-lg font-bold">
          <span className="text-[var(--t1)]">Итого:</span>
          <span className="text-[var(--a)]">{formatCurrency(summary.totalCost)}</span>
        </div>

        {/* Draft saved indicator */}
        {!isPersisted && summary.itemCount > 0 && (
          <div className="flex items-center gap-2 text-[var(--t3)] text-xs">
            <CheckCircle2 className="h-3 w-3" />
            <span>Черновик сохранён</span>
          </div>
        )}

        {/* Warnings */}
        {summary.warnings.length > 0 && (
          <>
            <Separator className="bg-[var(--borderl)]" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--warn)]">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">Внимание к складу</span>
              </div>
              <ul className="text-xs text-[var(--warn)] space-y-1">
                {summary.warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Success */}
        {summary.warnings.length === 0 && summary.itemCount > 0 && (
          <div className="flex items-center gap-2 text-[var(--ok)] text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Все ткани в наличии</span>
          </div>
        )}

        {/* Reset */}
        {rooms.length > 0 && (
          <>
            <Separator className="bg-[var(--borderl)]" />
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="w-full border-[var(--border-sheber)] text-[var(--err)] hover:bg-[var(--err-bg)] hover:text-[var(--err)]"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Очистить смету
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
