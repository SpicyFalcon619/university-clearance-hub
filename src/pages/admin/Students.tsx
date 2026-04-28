import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

export default function Students() {
  const [users, setUsers] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [assign, setAssign] = useState<{ userId: string; role: string; deptId: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
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
  }

  async function applyRole() {
    if (!assign) return;
    // Clear existing admin roles for clean assignment
    await supabase.from("user_roles").delete().eq("user_id", assign.userId).in("role", ["dept_admin", "master_admin"]);
    if (assign.role === "student") {
      // ensure student row exists
      await supabase.from("user_roles").upsert({ user_id: assign.userId, role: "student" } as any, { onConflict: "user_id,role,department_id" });
    } else if (assign.role === "master_admin") {
      await supabase.from("user_roles").insert({ user_id: assign.userId, role: "master_admin" });
    } else if (assign.role === "dept_admin") {
      if (!assign.deptId) { toast.error("Select a department"); return; }
      await supabase.from("user_roles").insert({ user_id: assign.userId, role: "dept_admin", department_id: assign.deptId });
    }
    toast.success("Role updated");
    setAssign(null); load();
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
            <p className="text-sm text-muted-foreground">Search students and assign administrator roles.</p>
          </div>
          <Input placeholder="Search…" className="w-64" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="space-y-2">
          {filtered.map(u => {
            const role = u.roles.find((r: any) => r.role === "master_admin") ? "master_admin"
              : u.roles.find((r: any) => r.role === "dept_admin") ? "dept_admin" : "student";
            const deptId = u.roles.find((r: any) => r.role === "dept_admin")?.department_id;
            const deptName = depts.find(d => d.id === deptId)?.name;
            return (
              <Card key={u.id}>
                <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{u.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-secondary">
                      {role === "master_admin" ? "Master Admin" : role === "dept_admin" ? `Dept Admin · ${deptName || "—"}` : "Student"}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setAssign({ userId: u.id, role, deptId: deptId || "" })}>Edit role</Button>
                    <Button asChild size="sm" variant="ghost"><Link to={`/admin/students/${u.id}`}><ChevronRight className="w-4 h-4" /></Link></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {assign && (
          <Card>
            <CardHeader><CardTitle className="text-base">Edit role</CardTitle><CardDescription>Assign user role and department.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
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
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAssign(null)}>Cancel</Button>
                <Button onClick={applyRole}>Save</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
