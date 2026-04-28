import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Download, Search, Users, FileCheck2, Clock, AlertTriangle } from "lucide-react";

type AppRow = {
  id: string; student_id: string; course: string; batch: string; is_emergency: boolean;
  overall_status: "not_started" | "in_progress" | "action_required" | "completed";
  created_at: string;
  student?: { full_name: string; email: string };
};

export function MasterDashboard() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [bottlenecks, setBottlenecks] = useState<{ name: string; pending: number }[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
    const list = (data as any[]) || [];
    const ids = Array.from(new Set(list.map(a => a.student_id)));
    const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    const m = new Map((profs || []).map(p => [p.id, p]));
    setApps(list.map(a => ({ ...a, student: m.get(a.student_id) as any })));

    // Bottlenecks
    const { data: ds } = await supabase.from("department_status")
      .select("status, departments(name)").eq("status", "pending");
    const counts = new Map<string, number>();
    (ds || []).forEach((r: any) => {
      const n = r.departments?.name || "—";
      counts.set(n, (counts.get(n) || 0) + 1);
    });
    setBottlenecks(Array.from(counts.entries()).map(([name, pending]) => ({ name, pending })).sort((a,b) => b.pending - a.pending));
  }

  const filtered = useMemo(() => apps.filter(a => {
    if (statusFilter !== "all" && a.overall_status !== statusFilter) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(a.student?.full_name?.toLowerCase().includes(s) || a.student?.email?.toLowerCase().includes(s) || a.course.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [apps, statusFilter, q]);

  const total = apps.length;
  const completed = apps.filter(a => a.overall_status === "completed").length;
  const inProgress = apps.filter(a => a.overall_status === "in_progress").length;
  const actionReq = apps.filter(a => a.overall_status === "action_required").length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  function exportCsv() {
    const header = ["ID","Student","Email","Course","Batch","Status","Emergency","Created"];
    const rows = filtered.map(a => [a.id, a.student?.full_name || "", a.student?.email || "", a.course, a.batch, a.overall_status, a.is_emergency ? "yes" : "no", new Date(a.created_at).toISOString()]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `clearance-report-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">Global metrics, search, and clearance management.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1.5" />Export CSV</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Users} label="Total applications" value={total} />
        <Stat icon={FileCheck2} label="Completion rate" value={`${completionRate}%`} />
        <Stat icon={Clock} label="In progress" value={inProgress} />
        <Stat icon={AlertTriangle} label="Action required" value={actionReq} tone="danger" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <CardTitle className="text-base">Applications</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search name, email, course…" className="pl-8 w-64" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="action_required">Action Required</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No applications match your filter.</div>
            ) : filtered.map(a => (
              <Link key={a.id} to={`/admin/students/${a.student_id}`} className="block rounded-lg border surface-1 p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-secondary/40 transition-colors">
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {a.student?.full_name || "Student"}
                    {a.is_emergency && <StatusBadge status="emergency" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{a.course} · {a.batch} · {a.student?.email}</div>
                </div>
                <StatusBadge status={a.overall_status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department bottlenecks</CardTitle>
            <CardDescription>Where pending requests pile up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bottlenecks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No pending requests anywhere. 🎉</div>
            ) : bottlenecks.map(b => (
              <div key={b.name} className="flex items-center justify-between text-sm">
                <span>{b.name}</span>
                <span className="font-medium tabular-nums">{b.pending}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${tone === "danger" ? "bg-status-denied-bg text-status-denied" : "bg-secondary text-foreground"}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
