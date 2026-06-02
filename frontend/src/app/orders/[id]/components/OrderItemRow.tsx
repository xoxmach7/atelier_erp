import type { OrderItemDTO } from "@/types";
import { formatCurrency, getFabricLabel } from "./order-helpers";

export function OrderItemRow({ item }: { item: OrderItemDTO }) {
  // Get safe fabric label - never shows UUID
  const fabricLabel = getFabricLabel(item);
  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0">
      <div className="flex-1">
        <div className="font-medium">{item.notes || item.item_type}</div>
        <div className="text-sm text-slate-500 mt-1">
          {item.item_type}
          {fabricLabel && ` • ${fabricLabel}`}
          {item.cornice && ` • ${item.cornice}`}
          {item.service && ` • ${item.service}`}
          {item.window_width_cm && item.window_height_cm && ` • ${item.window_width_cm}×${item.window_height_cm}cm`}
        </div>
      </div>
      <div className="text-right ml-4">
        <div className="font-medium">
          {item.quantity} × {formatCurrency(item.unit_price)}
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {formatCurrency(item.total_price)}
        </div>
      </div>
    </div>
  );
}
