import { CheckCircle2, Clock, XCircle, AlertTriangle, Siren } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "approved" | "pending" | "denied" | "in_progress" | "completed" | "action_required" | "not_started" | "emergency";

const map: Record<Variant, { label: string; cls: string; Icon: any }> = {
  approved: { label: "Approved", cls: "bg-status-approved-bg text-status-approved border-status-approved/20", Icon: CheckCircle2 },
  completed: { label: "Completed", cls: "bg-status-approved-bg text-status-approved border-status-approved/20", Icon: CheckCircle2 },
  pending: { label: "Pending", cls: "bg-status-pending-bg text-status-pending border-status-pending/20", Icon: Clock },
  in_progress: { label: "In Progress", cls: "bg-status-pending-bg text-status-pending border-status-pending/20", Icon: Clock },
  not_started: { label: "Not Started", cls: "bg-muted text-muted-foreground border-border", Icon: Clock },
  denied: { label: "Denied", cls: "bg-status-denied-bg text-status-denied border-status-denied/20", Icon: XCircle },
  action_required: { label: "Action Required", cls: "bg-status-denied-bg text-status-denied border-status-denied/20", Icon: AlertTriangle },
  emergency: { label: "Urgent", cls: "bg-status-emergency-bg text-status-emergency border-status-emergency/30", Icon: Siren },
};

export function StatusBadge({ status, className }: { status: Variant; className?: string }) {
  const m = map[status];
  if (!m) return null;
  const { Icon, label, cls } = m;
  return (
    <span className={cn("status-badge", cls, className)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
