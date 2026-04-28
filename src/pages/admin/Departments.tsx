import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Departments() {
  const [depts, setDepts] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from("departments").select("*").order("name");
    setDepts(data || []);
  }

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("departments").insert({ name: name.trim(), description: desc.trim() || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Department added"); setName(""); setDesc(""); load();
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("departments").update({ active }).eq("id", id);
    load();
  }

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="text-sm text-muted-foreground">Configure which departments route clearance requests.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Add department</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Transport" /></div>
              <div className="space-y-1.5"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" /></div>
            </div>
            <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {depts.map(d => (
            <Card key={d.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{d.name}</div>
                  {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{d.active ? "Active" : "Inactive"}</span>
                  <Switch checked={d.active} onCheckedChange={(v) => toggle(d.id, v)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
