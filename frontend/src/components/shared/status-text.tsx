import { cn } from "@/lib/utils";
import { getStatusHex, getStatusLabel } from "@/lib/status-colors";

interface StatusTextProps {
  status: string;
  className?: string;
}

/**
 * StatusText — цветной текст статуса (без фона/badge).
 * Как в Figma: TT Norms Pro, 500, цветной текст.
 */
export function StatusText({ status, className }: StatusTextProps) {
  const color = getStatusHex(status);
  const label = getStatusLabel(status);

  return (
    <span className={cn("font-medium", className)} style={{ color }}>
      {label}
    </span>
  );
}
