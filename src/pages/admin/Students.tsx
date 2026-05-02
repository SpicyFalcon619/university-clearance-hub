import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChevronRight, Users as UsersIcon, Loader2, X, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeletons";

export default function Students() {
  const [users, setUsers] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assign, setAssign] = useState<{ userId: string; role: string; deptId: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: profs }, { data: roles }, { data: dps }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("departments").select("*").order("name"),
    ]);
    const rolesByUser = new Map<string, any[]>();
    (roles || []).forEach(r => {
      const arr = rolesByUser.get(r.user_id) || [];
      arr.push(r); rolesByUser.set(r.user_id, arr);
    });
    setUsers((profs || []).map(p => ({ ...p, roles: rolesByUser.get(p.id) || [] })));
    setDepts(dps || []);
    setLoading(false);
  }

  async function applyRole() {
    if (!assign) return;
    setSaving(true);
    try {
      await supabase.from("user_roles").delete().eq("user_id", assign.userId).in("role", ["dept_admin", "master_admin"]);
      if (assign.role === "student") {
        await supabase.from("user_roles").upsert({ user_id: assign.userId, role: "student" } as any, { onConflict: "user_id,role,department_id" });
      } else if (assign.role === "master_admin") {
        await supabase.from("user_roles").insert({ user_id: assign.userId, role: "master_admin" });
      } else if (assign.role === "dept_admin") {
        if (!assign.deptId) { toast.error("Select a department"); setSaving(false); return; }
        await supabase.from("user_roles").insert({ user_id: assign.userId, role: "dept_admin", department_id: assign.deptId });
      }
      toast.success("Role updated");
      setAssign(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter(u => {
    if (!q) return true;
    const s = q.toLowerCase();
    return u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
  });

  return (
    <AppShell>
      <div className="max-w-5xl space-y-6">
        <div className="flex justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Users</h1>
            <p className="text-sm text-muted-foreground">All accounts — students and administrators. Search and assign roles.</p>
          </div>
          <Input placeholder="Search…" className="w-64" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading ? (
          <ListRowSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={q ? "No users match your search" : "No users yet"}
            description={q ? "Try a different name or email." : "When people sign up, they'll appear here for role assignment."}
            variant="primary"
            action={q ? <Button variant="outline" onClick={() => setQ("")}>Clear search</Button> : undefined}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(u => {
              const role = u.roles.find((r: any) => r.role === "master_admin") ? "master_admin"
                : u.roles.find((r: any) => r.role === "dept_admin") ? "dept_admin" : "student";
              const deptId = u.roles.find((r: any) => r.role === "dept_admin")?.department_id;
              const deptName = depts.find(d => d.id === deptId)?.name;
              const isEditing = assign?.userId === u.id;
              return (
                <div key={u.id} className="space-y-2">
                  <Card className={isEditing ? "ring-2 ring-primary/40" : ""}>
                    <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          role === "master_admin" ? "bg-primary/10 text-primary border-primary/20" :
                          role === "dept_admin" ? "bg-status-pending-bg text-status-pending border-status-pending/20" :
                          "bg-secondary border-border"
                        }`}>
                          {role === "master_admin" ? "Master Admin" : role === "dept_admin" ? `Dept Admin · ${deptName || "—"}` : "Student"}
                        </span>
                        <Button
                          size="sm"
                          variant={isEditing ? "secondary" : "ghost"}
                          onClick={() => isEditing
                            ? setAssign(null)
                            : setAssign({ userId: u.id, role, deptId: deptId || "" })}
                        >
                          {isEditing ? "Close" : "Edit role"}
                        </Button>
                        <Button asChild size="sm" variant="ghost"><Link to={`/admin/students/${u.id}`}><ChevronRight className="w-4 h-4" /></Link></Button>
                      </div>
                    </CardContent>
                  </Card>

                  {isEditing && assign && (
                    <Card className="ml-4 border-primary/30 bg-primary/[0.03] animate-fade-in">
                      <CardContent className="py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Edit role for {u.full_name || u.email}</div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAssign(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Role</Label>
                            <Select value={assign.role} onValueChange={(v) => setAssign({ ...assign, role: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="dept_admin">Department Admin</SelectItem>
                                <SelectItem value="master_admin">Master Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {assign.role === "dept_admin" && (
                            <div className="space-y-1.5">
                              <Label>Department</Label>
                              <Select value={assign.deptId} onValueChange={(v) => setAssign({ ...assign, deptId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                                <SelectContent>{depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button variant="ghost" onClick={() => setAssign(null)} disabled={saving}>Cancel</Button>
                          <Button onClick={applyRole} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                            Save
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
