import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Application, DeptStatusRow, Department } from "@/types/clearance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, Plus, FileText, Download, Sparkles, RotateCcw, AlertTriangle, MessageSquare } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { ApplicationCardSkeleton } from "@/components/Skeletons";

export function StudentDashboard() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [statuses, setStatuses] = useState<DeptStatusRow[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [resub, setResub] = useState<{ deptStatusId: string; deptName: string; comments: string } | null>(null);
  const [resubMsg, setResubMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel("student-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "department_status" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `student_id=eq.${user.id}` }, () => load())
      .subscribe();
    // notification toasts
    const nch = supabase.channel("student-notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        toast(payload.new.title, { description: payload.new.body });
      }).subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(nch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function load() {
    setLoading(true);
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from("applications").select("*").eq("student_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("departments").select("*").eq("active", true).order("name"),
    ]);
    setApps((a as any) || []);
    setDepts((d as any) || []);
    if (a && a.length) {
      const ids = a.map((x: any) => x.id);
      const { data: s } = await supabase.from("department_status").select("*").in("application_id", ids);
      setStatuses((s as any) || []);
    } else setStatuses([]);
    setLoading(false);
  }

  async function requestReeval(deptStatusId: string, message: string) {
    // optimistic
    setStatuses(prev => prev.map(s => s.id === deptStatusId ? { ...s, status: "pending", comments: null, reviewed_at: null, reviewed_by: null } : s));
    const { error } = await supabase.from("department_status").update({
      status: "pending", comments: null, reviewed_at: null, reviewed_by: null, undo_deadline: null,
    }).eq("id", deptStatusId);
    if (error) { toast.error("Failed to request re-evaluation"); load(); return; }
    const ds = statuses.find(s => s.id === deptStatusId);
    if (ds) {
      await supabase.from("audit_log").insert({
        application_id: ds.application_id, department_id: ds.department_id, actor_id: user!.id,
        action: "student_resubmit", comments: message,
      });
    }
    toast.success("Re-evaluation requested");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Your Clearance</h1>
            <p className="text-sm text-muted-foreground">Track approvals across departments and download your certificate.</p>
          </div>
          <Button asChild><Link to="/apply"><Plus className="w-4 h-4 mr-1.5" />New Application</Link></Button>
        </div>
        <ApplicationCardSkeleton />
      </div>
    );
  }

  const active = apps[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Your Clearance</h1>
          <p className="text-sm text-muted-foreground">Track approvals across departments and download your certificate.</p>
        </div>
        <Button asChild><Link to="/apply"><Plus className="w-4 h-4 mr-1.5" />New Application</Link></Button>
      </div>

      {!active ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-medium">No applications yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">Start your clearance process by submitting a new application.</p>
            <Button asChild><Link to="/apply"><Plus className="w-4 h-4 mr-1.5" />Start Application</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <ApplicationCard
          app={active}
          statuses={statuses.filter(s => s.application_id === active.id)}
          depts={depts}
          onResub={(s, deptName) => { setResub({ deptStatusId: s.id, deptName, comments: s.comments || "" }); setResubMsg(""); }}
        />
      )}

      {apps.length > 1 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Previous applications</h2>
          {apps.slice(1).map(a => (
            <Card key={a.id}>
              <CardContent className="py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{a.course} · {a.batch}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <StatusBadge status={a.overall_status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!resub} onOpenChange={(o) => !o && setResub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request re-evaluation — {resub?.deptName}</DialogTitle>
            <DialogDescription>
              Department comment: <span className="text-foreground">{resub?.comments || "—"}</span>
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Briefly describe how you've resolved the issue…" value={resubMsg} onChange={(e) => setResubMsg(e.target.value)} maxLength={500} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResub(null)}>Cancel</Button>
            <Button onClick={async () => { if (resub) { await requestReeval(resub.deptStatusId, resubMsg); setResub(null); } }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationCard({ app, statuses, depts, onResub }: {
  app: Application; statuses: DeptStatusRow[]; depts: Department[];
  onResub: (s: DeptStatusRow, deptName: string) => void;
}) {
  const total = statuses.length || 1;
  const approved = statuses.filter(s => s.status === "approved").length;
  const progress = Math.round((approved / total) * 100);
  const completed = app.overall_status === "completed";

  const [generatingCert, setGeneratingCert] = useState(false);

  async function downloadCert() {
    setGeneratingCert(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-certificate', {
        body: { applicationId: app.id },
      });
      if (error) throw error;
      
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Clearance-Certificate.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Certificate downloaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate certificate.");
    } finally {
      setGeneratingCert(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {app.course} · {app.batch}
              {app.is_emergency && <StatusBadge status="emergency" />}
            </CardTitle>
            <CardDescription>Submitted {new Date(app.created_at).toLocaleDateString()}</CardDescription>
          </div>
          <StatusBadge status={app.overall_status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{approved} of {total} departments approved</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {app.is_emergency && app.emergency_justification && (
          <div className="rounded-md border border-status-emergency/20 bg-status-emergency-bg/50 p-3 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 text-status-emergency mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Marked urgent</div>
              <div className="text-muted-foreground">{app.emergency_justification}</div>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-2">
          {depts.map(d => {
            const s = statuses.find(x => x.department_id === d.id);
            return (
              <div key={d.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{d.name}</div>
                  {s?.comments && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                      <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{s.comments}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={s?.status === "approved" ? "approved" : s?.status === "denied" ? "denied" : "pending"} />
                  {s?.status === "denied" && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onResub(s, d.name)}>
                      <RotateCcw className="w-3 h-3 mr-1" />Re-evaluate
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t flex items-center justify-between gap-3">
          <div className="text-sm">
            {completed ? (
              <div className="flex items-center gap-2 text-status-approved font-medium">
                <Sparkles className="w-4 h-4" />Clearance complete
              </div>
            ) : (
              <span className="text-muted-foreground">Certificate unlocks once all departments approve.</span>
            )}
          </div>
          <Button disabled={!completed || generatingCert} onClick={downloadCert}>
            {generatingCert ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            {generatingCert ? "Generating..." : "Download Certificate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
