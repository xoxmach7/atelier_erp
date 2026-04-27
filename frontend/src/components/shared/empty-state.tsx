import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {description && (
        <div className="mt-1 max-w-sm text-sm text-slate-600">{description}</div>
      )}
      {action && (
        action.href ? (
          <Button asChild className="mt-4">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button onClick={action.onClick} className="mt-4">
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
