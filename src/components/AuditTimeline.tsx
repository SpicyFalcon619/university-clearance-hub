import {
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Undo2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AuditEntry = {
  id: string;
  action: string;
  comments?: string | null;
  created_at: string;
};

type Variant = {
  Icon: any;
  label: string;
  ring: string; // ring color class
  dot: string; // dot bg
  text: string; // text color
  chip: string; // chip bg
};

function variantFor(action: string): Variant {
  const a = action.toLowerCase();
  if (a.includes("master_override_approved"))
    return {
      Icon: ShieldCheck,
      label: "Master override · Approved",
      ring: "ring-status-approved/30",
      dot: "bg-status-approved",
      text: "text-status-approved",
      chip: "bg-status-approved-bg",
    };
  if (a.includes("master_override_denied"))
    return {
      Icon: ShieldX,
      label: "Master override · Denied",
      ring: "ring-status-denied/30",
      dot: "bg-status-denied",
      text: "text-status-denied",
      chip: "bg-status-denied-bg",
    };
  if (a === "approve" || a.includes("approved"))
    return {
      Icon: CheckCircle2,
      label: "Approved",
      ring: "ring-status-approved/30",
      dot: "bg-status-approved",
      text: "text-status-approved",
      chip: "bg-status-approved-bg",
    };
  if (a === "deny" || a.includes("denied"))
    return {
      Icon: XCircle,
      label: "Denied",
      ring: "ring-status-denied/30",
      dot: "bg-status-denied",
      text: "text-status-denied",
      chip: "bg-status-denied-bg",
    };
  if (a === "undo")
    return {
      Icon: Undo2,
      label: "Reverted",
      ring: "ring-muted-foreground/20",
      dot: "bg-muted-foreground",
      text: "text-muted-foreground",
      chip: "bg-muted",
    };
  if (a === "student_resubmit" || a.includes("resubmit"))
    return {
      Icon: RotateCcw,
      label: "Re-evaluation requested",
      ring: "ring-status-pending/30",
      dot: "bg-status-pending",
      text: "text-status-pending",
      chip: "bg-status-pending-bg",
    };
  if (a.includes("submit") || a.includes("create"))
    return {
      Icon: FileText,
      label: "Submitted",
      ring: "ring-primary/30",
      dot: "bg-primary",
      text: "text-primary",
      chip: "bg-primary/10",
    };
  return {
    Icon: Clock,
    label: action.replace(/_/g, " "),
    ring: "ring-border",
    dot: "bg-muted-foreground",
    text: "text-foreground",
    chip: "bg-secondary",
  };
}

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground rounded-md border border-dashed py-6 text-center">
        No actions yet.
      </div>
    );
  }
  // chronological top-to-bottom (newest first kept as-is, but visually a timeline)
  return (
    <ol className="relative pl-6">
      <span
        aria-hidden
        className="absolute left-2 top-1 bottom-1 w-px bg-gradient-to-b from-primary/40 via-border to-border"
      />
      {entries.map((e) => {
        const v = variantFor(e.action);
        const Icon = v.Icon;
        return (
          <li key={e.id} className="relative pb-4 last:pb-0">
            <span
              className={cn(
                "absolute -left-[18px] top-0.5 w-4 h-4 rounded-full ring-4 ring-background",
                v.dot
              )}
              aria-hidden
            />
            <div
              className={cn(
                "rounded-lg border p-2.5 ring-1",
                v.ring,
                "bg-card"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                    v.chip,
                    v.text
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {v.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              {e.comments && (
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {e.comments}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
