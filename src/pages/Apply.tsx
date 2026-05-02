import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, UploadCloud, X, FileText, Siren } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Department } from "@/types/clearance";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/jpg"];

const schema = z.object({
  course: z.string().trim().min(2, "Course required").max(100),
  batch: z.string().trim().min(2, "Batch required").max(50),
  reason: z.string().trim().max(500).optional(),
  is_emergency: z.boolean(),
  emergency_justification: z.string().trim().max(500).optional(),
});

export default function Apply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [depts, setDepts] = useState<Department[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [drag, setDrag] = useState(false);
  const [form, setForm] = useState({ course: "", batch: "", reason: "", is_emergency: false, emergency_justification: "" });

  useEffect(() => {
    supabase.from("departments").select("*").eq("active", true).order("name")
      .then(({ data }) => setDepts((data as any) || []));
    if (user) {
      supabase.from("profiles").select("course,batch").eq("id", user.id).single().then(({ data }) => {
        if (data) setForm(f => ({ ...f, course: data.course || "", batch: data.batch || "" }));
      });
    }
  }, [user?.id]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!ALLOWED.includes(f.type)) { toast.error(`${f.name}: only PDF or JPG`); continue; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: max 5MB`); continue; }
      next.push(f);
    }
    setFiles(prev => [...prev, ...next]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (parsed.data.is_emergency && !parsed.data.emergency_justification) {
      toast.error("Please justify the urgent request"); return;
    }
    if (files.length === 0) { toast.error("Please upload at least one supporting document"); return; }
    setSubmitting(true);

    const { data: app, error } = await supabase.from("applications").insert({
      student_id: user!.id,
      course: parsed.data.course, batch: parsed.data.batch, reason: parsed.data.reason || null,
      is_emergency: parsed.data.is_emergency,
      emergency_justification: parsed.data.is_emergency ? parsed.data.emergency_justification : null,
    }).select().single();

    if (error || !app) { toast.error(error?.message || "Failed to submit"); setSubmitting(false); return; }

    // upload files
    for (const f of files) {
      const path = `${user!.id}/${app.id}/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage.from("clearance-docs").upload(path, f);
      if (upErr) { toast.error(`Upload failed: ${f.name}`); continue; }
      await supabase.from("documents").insert({
        application_id: app.id, uploaded_by: user!.id,
        file_name: f.name, file_path: path, mime_type: f.type, size_bytes: f.size,
      });
    }

    // update profile course/batch
    await supabase.from("profiles").update({ course: parsed.data.course, batch: parsed.data.batch }).eq("id", user!.id);

    toast.success("Application submitted");
    setSubmitting(false);
    navigate("/");
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">New clearance application</h1>
          <p className="text-sm text-muted-foreground">Provide your details and upload supporting documents.</p>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Course details</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="course">Course / Program</Label>
                <Input id="course" placeholder="BSc in CSE / BBA / BSc in EEE" required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch">Batch / Trimester</Label>
                <Input id="batch" placeholder="221 / Spring 2025" required value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="reason">Reason for clearance (optional)</Label>
                <Textarea id="reason" maxLength={500} placeholder="Graduation, semester drop, transfer, etc." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Supporting documents</CardTitle>
              <CardDescription>PDF or JPG · max 5MB each</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                className={`block rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${drag ? "border-accent bg-accent/5" : "border-border hover:bg-secondary/40"}`}
              >
                <UploadCloud className="w-6 h-6 mx-auto text-muted-foreground" />
                <div className="text-sm font-medium mt-2">Drag & drop or click to upload</div>
                <div className="text-xs text-muted-foreground mt-1">PDF, JPG up to 5MB</div>
                <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg" onChange={(e) => addFiles(e.target.files)} />
              </label>

              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{(f.size/1024).toFixed(0)} KB</span>
                      </span>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Siren className="w-4 h-4 text-status-emergency" />Emergency request</CardTitle>
              <CardDescription>Mark this application as urgent for prioritized review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="urgent" className="text-sm">Mark as urgent</Label>
                <Switch id="urgent" checked={form.is_emergency} onCheckedChange={(v) => setForm({ ...form, is_emergency: v })} />
              </div>
              {form.is_emergency && (
                <div className="space-y-1.5">
                  <Label htmlFor="just">Justification</Label>
                  <Textarea id="just" required maxLength={500} placeholder="Explain why this needs urgent processing" value={form.emergency_justification} onChange={(e) => setForm({ ...form, emergency_justification: e.target.value })} />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="rounded-md border bg-surface-3 p-3 text-sm">
            Departments routed: <span className="font-medium">{depts.map(d => d.name).join(", ")}</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/")}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit application
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
