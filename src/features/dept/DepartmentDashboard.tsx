import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, Siren, Undo2, Download, Inbox, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { QueueSkeleton } from "@/components/Skeletons";

type QueueRow = {
  ds_id: string;
  application_id: string;
  status: "pending" | "approved" | "denied";
  comments: string | null;
  reviewed_at: string | null;
  undo_deadline: string | null;
  app: { id: string; course: string; batch: string; is_emergency: boolean; created_at: string; student_id: string };
  student: { full_name: string; email: string } | null;
};

export function DepartmentDashboard() {
  const { user, departmentId } = useAuth();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<QueueRow | null>(null);
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyComment, setDenyComment] = useState("");
  const [docs, setDocs] = useState<{ name: string; url: string }[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!departmentId) return;
    load();
    const ch = supabase.channel("dept-q")
      .on("postgres_changes", { event: "*", schema: "public", table: "department_status", filter: `department_id=eq.${departmentId}` }, () => load())
      .subscribe();
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [departmentId]);

  async function load() {
    if (!departmentId) return;
    setLoading(true);
    const { data } = await supabase
      .from("department_status")
      .select("id, application_id, status, comments, reviewed_at, undo_deadline, applications(id, course, batch, is_emergency, created_at, student_id)")
      .eq("department_id", departmentId)
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false });

    const apps = (data || []) as any[];
    const ids = Array.from(new Set(apps.map(r => r.applications?.student_id).filter(Boolean)));
    const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    const profMap = new Map((profs || []).map(p => [p.id, p]));

    setRows(apps.map(r => ({
      ds_id: r.id, application_id: r.application_id, status: r.status, comments: r.comments,
      reviewed_at: r.reviewed_at, undo_deadline: r.undo_deadline,
      app: r.applications, student: profMap.get(r.applications?.student_id) as any,
    })));
    setLoading(false);
  }

  async function openReview(r: QueueRow) {
    setReviewing(r);
    const { data: docList } = await supabase.from("documents").select("file_name, file_path").eq("application_id", r.application_id);
    const urls: { name: string; url: string }[] = [];
    for (const d of docList || []) {
      const { data: signed } = await supabase.storage.from("clearance-docs").createSignedUrl(d.file_path, 3600);
      if (signed) urls.push({ name: d.file_name, url: signed.signedUrl });
    }
    setDocs(urls);
  }

  async function approve(r: QueueRow) {
    const deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    setRows(prev => prev.map(x => x.ds_id === r.ds_id ? { ...x, status: "approved", reviewed_at: new Date().toISOString(), undo_deadline: deadline, comments: null } : x));
    const { error } = await supabase.from("department_status").update({
      status: "approved", reviewed_by: user!.id, reviewed_at: new Date().toISOString(), undo_deadline: deadline, comments: null,
    }).eq("id", r.ds_id);
    if (error) { toast.error("Failed"); load(); return; }
    await supabase.from("audit_log").insert({ application_id: r.application_id, department_id: departmentId, actor_id: user!.id, action: "approve" });
    toast.success("Approved", { description: "You have 5 minutes to undo." });
    setReviewing(null);
  }

  async function deny(r: QueueRow, comment: string) {
    if (!comment.trim()) { toast.error("Comment required for denial"); return; }
    setRows(prev => prev.map(x => x.ds_id === r.ds_id ? { ...x, status: "denied", reviewed_at: new Date().toISOString(), comments: comment, undo_deadline: null } : x));
    const { error } = await supabase.from("department_status").update({
      status: "denied", reviewed_by: user!.id, reviewed_at: new Date().toISOString(), comments: comment, undo_deadline: null,
    }).eq("id", r.ds_id);
    if (error) { toast.error("Failed"); load(); return; }
    await supabase.from("audit_log").insert({ application_id: r.application_id, department_id: departmentId, actor_id: user!.id, action: "deny", comments: comment });
    toast.success("Denied with comment");
    setReviewing(null); setDenyOpen(false); setDenyComment("");
  }

  async function undo(r: QueueRow) {
    setRows(prev => prev.map(x => x.ds_id === r.ds_id ? { ...x, status: "pending", reviewed_at: null, undo_deadline: null } : x));
    const { error } = await supabase.from("department_status").update({
      status: "pending", reviewed_by: null, reviewed_at: null, undo_deadline: null, comments: null,
    }).eq("id", r.ds_id);
    if (error) { toast.error("Undo failed"); load(); return; }
    await supabase.from("audit_log").insert({ application_id: r.application_id, department_id: departmentId, actor_id: user!.id, action: "undo" });
    toast.success("Reverted to pending");
  }

  const pending = rows.filter(r => r.status === "pending");
  const emergency = pending.filter(r => r.app?.is_emergency);
  const approved = rows.filter(r => r.status === "approved");
  const denied = rows.filter(r => r.status === "denied");

  if (!departmentId) return <div className="text-sm text-muted-foreground">No department assigned. Contact Master Admin.</div>;
  if (loading) return <QueueSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Department Queue</h1>
        <p className="text-sm text-muted-foreground">Review and act on clearance requests assigned to your department.</p>
      </div>

      {emergency.length > 0 && (
        <Card className="border-status-emergency/30 bg-status-emergency-bg/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Siren className="w-4 h-4 text-status-emergency" />Urgent queue ({emergency.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {emergency.map(r => <Row key={r.ds_id} r={r} now={now} onReview={openReview} onUndo={undo} />)}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="denied">Denied ({denied.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-2 mt-4">
          {pending.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Inbox zero"
              description="No pending requests right now. Great work keeping the queue clear!"
              variant="success"
            />
          ) : pending.map(r => <Row key={r.ds_id} r={r} now={now} onReview={openReview} onUndo={undo} />)}
        </TabsContent>
        <TabsContent value="approved" className="space-y-2 mt-4">
          {approved.length === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="No approvals yet"
              description="Approved requests will appear here for reference."
              variant="neutral"
            />
          ) : approved.map(r => <Row key={r.ds_id} r={r} now={now} onReview={openReview} onUndo={undo} />)}
        </TabsContent>
        <TabsContent value="denied" className="space-y-2 mt-4">
          {denied.length === 0 ? (
            <EmptyState
              icon={XCircle}
              title="No denied requests"
              description="Nothing has been denied yet."
              variant="neutral"
            />
          ) : denied.map(r => <Row key={r.ds_id} r={r} now={now} onReview={openReview} onUndo={undo} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewing?.student?.full_name || "Student"}
              {reviewing?.app?.is_emergency && <StatusBadge status="emergency" />}
            </DialogTitle>
            <DialogDescription>
              {reviewing?.student?.email} · {reviewing?.app?.course} · {reviewing?.app?.batch}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Documents</div>
              {docs.length === 0 ? (
                <div className="text-sm text-muted-foreground">No documents uploaded.</div>
              ) : (
                <ul className="space-y-1">
                  {docs.map((d, i) => (
                    <li key={i}>
                      <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-accent hover:underline">
                        <Download className="w-4 h-4" />{d.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {reviewing?.comments && (
              <div className="rounded-md border bg-surface-2 p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">Previous comment</div>
                {reviewing.comments}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDenyOpen(true)}>
              <XCircle className="w-4 h-4 mr-1.5" />Deny
            </Button>
            <Button onClick={() => reviewing && approve(reviewing)}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={denyOpen} onOpenChange={setDenyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny request</DialogTitle>
            <DialogDescription>Provide a clear reason / dues description. The student will see this.</DialogDescription>
          </DialogHeader>
          <Textarea required maxLength={500} placeholder="e.g., Outstanding library fine of ৳500 unpaid." value={denyComment} onChange={(e) => setDenyComment(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDenyOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => reviewing && deny(reviewing, denyComment)}>Confirm denial</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ r, now, onReview, onUndo }: { r: QueueRow; now: number; onReview: (r: QueueRow) => void; onUndo: (r: QueueRow) => void }) {
  const undoLeft = r.undo_deadline ? Math.max(0, new Date(r.undo_deadline).getTime() - now) : 0;
  const canUndo = r.status === "approved" && undoLeft > 0;
  return (
    <div className="rounded-lg border surface-1 p-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium text-sm flex items-center gap-2">
          {r.student?.full_name || "Student"}
          {r.app?.is_emergency && <StatusBadge status="emergency" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {r.app?.course} · {r.app?.batch} · {r.student?.email}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={r.status} />
        {canUndo && (
          <Button size="sm" variant="outline" onClick={() => onUndo(r)}>
            <Undo2 className="w-3.5 h-3.5 mr-1" />Undo ({Math.ceil(undoLeft / 1000)}s)
          </Button>
        )}
        <Button size="sm" onClick={() => onReview(r)}>Review</Button>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{label}</div>;
}
