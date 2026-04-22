import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  className?: string;
  fullPage?: boolean;
}

export function LoadingState({
  message = "Loading...",
  className,
  fullPage = false,
}: LoadingStateProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
