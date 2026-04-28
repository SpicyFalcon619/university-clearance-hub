import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, ShieldCheck, ShieldX, Download } from "lucide-react";
import { toast } from "sonner";
import { generateCertificate } from "@/lib/certificate";

export default function StudentDetail() {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    const [{ data: p }, { data: a }, { data: d }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id!).single(),
      supabase.from("applications").select("*").eq("student_id", id!).order("created_at", { ascending: false }),
      supabase.from("departments").select("*").order("name"),
    ]);
    setProfile(p); setApps(a || []); setDepts(d || []);
    if (a && a.length) {
      const ids = a.map(x => x.id);
      const [{ data: s }, { data: au }, { data: dc }] = await Promise.all([
        supabase.from("department_status").select("*").in("application_id", ids),
        supabase.from("audit_log").select("*").in("application_id", ids).order("created_at", { ascending: false }),
        supabase.from("documents").select("*").in("application_id", ids),
      ]);
      setStatuses(s || []); setAudit(au || []); setDocs(dc || []);
    }
  }

  async function override(dsId: string, newStatus: "approved" | "denied", comment: string) {
    const { error } = await supabase.from("department_status").update({
      status: newStatus, comments: comment || null, reviewed_at: new Date().toISOString(), undo_deadline: null,
    }).eq("id", dsId);
    if (error) { toast.error(error.message); return; }
    const ds = statuses.find(s => s.id === dsId);
    if (ds) {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("audit_log").insert({
        application_id: ds.application_id, department_id: ds.department_id, actor_id: u.user!.id,
        action: `master_override_${newStatus}`, comments: comment,
      });
    }
    toast.success("Override applied");
    load();
  }

  async function downloadCert(app: any) {
    let ref = app.certificate_ref;
    if (!ref) {
      ref = `CL-${new Date().getFullYear()}-${app.id.slice(0, 8).toUpperCase()}`;
      await supabase.from("applications").update({ certificate_ref: ref, certificate_issued_at: new Date().toISOString() }).eq("id", app.id);
    }
    generateCertificate({
      reference: ref, studentName: profile?.full_name || "Student", course: app.course, batch: app.batch,
      issuedAt: new Date(), departments: depts.map(d => d.name),
    });
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <Button asChild variant="ghost" size="sm"><Link to="/admin"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>

        <div>
          <h1 className="text-2xl font-semibold">{profile?.full_name || "Student"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>

        {apps.map(app => {
          const appStatuses = statuses.filter(s => s.application_id === app.id);
          const appDocs = docs.filter(d => d.application_id === app.id);
          const appAudit = audit.filter(a => a.application_id === app.id);
          return (
            <Card key={app.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">{app.course} · {app.batch} {app.is_emergency && <StatusBadge status="emergency" />}</CardTitle>
                    <CardDescription>Submitted {new Date(app.created_at).toLocaleString()}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={app.overall_status} />
                    <Button size="sm" disabled={app.overall_status !== "completed"} onClick={() => downloadCert(app)}>
                      <Download className="w-3.5 h-3.5 mr-1" />Certificate
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-2">
                  {depts.map(d => {
                    const s = appStatuses.find(x => x.department_id === d.id);
                    return (
                      <div key={d.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{d.name}</div>
                          <StatusBadge status={(s?.status as any) || "pending"} />
                        </div>
                        {s?.comments && <div className="text-xs text-muted-foreground mt-1">{s.comments}</div>}
                        {s && (
                          <div className="flex gap-1 mt-2">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => override(s.id, "approved", "Master admin override")}>
                              <ShieldCheck className="w-3 h-3 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => {
                              const c = window.prompt("Reason for denial?") || ""; if (c) override(s.id, "denied", c);
                            }}>
                              <ShieldX className="w-3 h-3 mr-1" />Deny
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {appDocs.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Documents</div>
                    <ul className="space-y-1 text-sm">
                      {appDocs.map(d => <li key={d.id}>{d.file_name} <span className="text-xs text-muted-foreground">({Math.round((d.size_bytes || 0) / 1024)} KB)</span></li>)}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Audit trail</div>
                  {appAudit.length === 0 ? <div className="text-sm text-muted-foreground">No actions yet.</div> : (
                    <ul className="space-y-1 text-xs">
                      {appAudit.map(a => (
                        <li key={a.id} className="border-l-2 border-border pl-2 py-0.5">
                          <span className="font-medium">{a.action}</span> · {new Date(a.created_at).toLocaleString()}
                          {a.comments && <div className="text-muted-foreground">{a.comments}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
