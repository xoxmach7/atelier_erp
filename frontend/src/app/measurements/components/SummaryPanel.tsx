"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeasurementSummary } from "@/types";
import { Home, Square, Zap, AlertTriangle } from "lucide-react";

interface SummaryPanelProps {
  summary: MeasurementSummary;
}

export function SummaryPanel({ summary }: SummaryPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600">
          Сводка замера
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-slate-400" />
            <span className="text-sm">
              <span className="font-medium">{summary.totalRooms}</span> комнат
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="h-4 w-4 text-slate-400" />
            <span className="text-sm">
              <span className="font-medium">{summary.totalWindows}</span> окон
            </span>
          </div>
        </div>

        {summary.hasElectricCornice && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded">
            <Zap className="h-4 w-4" />
            <span className="text-sm">Есть электрокарнизы</span>
          </div>
        )}

        {summary.needsElectricalAccess && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Требуется доступ к электрике</span>
          </div>
        )}

        <div className="pt-2 border-t text-xs text-slate-500">
          Общий периметр: {summary.totalWidthCm + summary.totalHeightCm} см
        </div>
      </CardContent>
    </Card>
  );
}
