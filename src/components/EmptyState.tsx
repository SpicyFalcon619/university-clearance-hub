import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon: any;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "primary" | "success" | "warning" | "neutral";
  className?: string;
};

const variantMap: Record<NonNullable<Props["variant"]>, { ring: string; bg: string; icon: string; halo: string }> = {
  primary: {
    ring: "ring-primary/20",
    bg: "bg-primary/10",
    icon: "text-primary",
    halo: "from-primary/20 via-primary/5 to-transparent",
  },
  success: {
    ring: "ring-status-approved/20",
    bg: "bg-status-approved-bg",
    icon: "text-status-approved",
    halo: "from-status-approved/20 via-status-approved/5 to-transparent",
  },
  warning: {
    ring: "ring-status-pending/20",
    bg: "bg-status-pending-bg",
    icon: "text-status-pending",
    halo: "from-status-pending/20 via-status-pending/5 to-transparent",
  },
  neutral: {
    ring: "ring-border",
    bg: "bg-secondary",
    icon: "text-muted-foreground",
    halo: "from-muted/40 via-muted/10 to-transparent",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "primary",
  className,
}: Props) {
  const v = variantMap[variant];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed p-10 text-center animate-fade-in",
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 bg-gradient-to-b opacity-60",
          v.halo
        )}
      />
      <div className="flex flex-col items-center gap-3">
        <div
          className={cn(
            "relative w-16 h-16 rounded-2xl flex items-center justify-center ring-1 shadow-sm",
            v.bg,
            v.ring
          )}
        >
          <Icon className={cn("w-7 h-7", v.icon)} />
          <span
            aria-hidden
            className={cn("absolute inset-0 rounded-2xl animate-pulse opacity-30", v.bg)}
          />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-base">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {description}
            </p>
          )}
        </div>
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}
